// 내보내기 창 (S1-11b, PRD 03 FR-301 · FR-302 · FR-303 · FR-306 · FR-307)
// FILE > Export… (Ctrl+Shift+R) 와 상단의 ⤓ 버튼이 여는 창입니다. 설정 → 진행 중 → 완료 세 화면으로 바뀝니다.
// 소리 계산은 audio/ 폴더가 맡습니다: 범위와 꼬리 계산(export_plan.js), 렌더링(offline.js), WAV 인코딩(wav.js).
// 이 파일은 화면의 값을 읽고, 진행률을 보여 주고, 파일을 내려받게 하는 일만 합니다.

import { renderOffline } from '../audio/offline.js';
import { encodeWav, peakOfChannels, normalizeGain, wavByteLength } from '../audio/wav.js';
import {
  resolveExportRange, rangeSeconds, autoTailSeconds, exportFileName, sanitizeFileName, formatDuration, formatBytes, MAX_TAIL_SECONDS,
} from '../audio/export_plan.js';
import { exportSnapshot } from './sequencer-audio.js';
import { TICKS_PER_BAR } from './sequencer-arrange.js';
import { registerCommand } from './sequencer-commands.js';

const PREFS_KEY = 'studionx.export.v1';

let snap = null;          // 창을 연 순간의 화면 스냅샷 (창이 떠 있는 동안은 편집할 수 없으므로 그대로 씀)
let rendering = false;    // 렌더링 중인지
let cancelFlag = false;   // 중지 버튼을 눌렀는지
let result = null;        // 완료된 파일 { bytes, fileName }
let startedAt = 0;        // 렌더링 시작 시각 (남은 시간 어림)

/** 숫자를 최솟값과 최댓값 사이로 자름 (숫자가 아니면 기본값) */
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** 지난번에 고른 샘플레이트 · 비트 깊이 · 정규화를 읽음 (저장소를 못 쓰는 환경이면 빈 객체) */
function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/** 이번에 고른 값을 저장 */
function savePrefs(o) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ sampleRate: o.sampleRate, bitDepth: o.bitDepth, normalize: o.normalize, normalizeDb: o.normalizeDb }));
  } catch (e) { /* 저장소를 못 쓰면 다음에 기본값으로 시작할 뿐 */ }
}

/** 버튼 묶음(#ex-rate · #ex-depth)에서 data 값이 같은 버튼을 켬 */
function pickSegment(groupId, attr, value) {
  Array.prototype.forEach.call(document.getElementById(groupId).querySelectorAll('button'), function (b) {
    const on = b.dataset[attr] === String(value);
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

/** 켜진 버튼의 data 값 */
function segmentValue(groupId, attr) {
  const b = document.getElementById(groupId).querySelector('.is-on');
  return b ? Number(b.dataset[attr]) : 0;
}

/**
 * 창에 입력된 옵션을 한 객체로 읽음
 * @returns {{mode:string, fromBar:number, toBar:number, sampleRate:number, bitDepth:number, normalize:boolean, normalizeDb:number, tailSec:number, fileName:string}}
 */
function readOptions() {
  const checked = document.querySelector('input[name="ex-range"]:checked');
  return {
    mode: checked ? checked.value : 'all',
    fromBar: Number(document.getElementById('ex-from').value),
    toBar: Number(document.getElementById('ex-to').value),
    sampleRate: segmentValue('ex-rate', 'rate') || 44100,
    bitDepth: segmentValue('ex-depth', 'depth') || 16,
    normalize: document.getElementById('ex-norm').checked,
    normalizeDb: clampNumber(document.getElementById('ex-norm-db').value, -12, 0, -0.3),
    tailSec: clampNumber(document.getElementById('ex-tail').value, 0, MAX_TAIL_SECONDS, 0),
    fileName: sanitizeFileName(document.getElementById('ex-file').value.replace(/\.wav$/i, '')),
  };
}

/** 오디오와 MIDI 클립 전부 */
function allClips() {
  return snap.audioClips.concat(snap.midiClips);
}

/** 선택된 클립 (오디오와 MIDI) */
function selectedClips() {
  return allClips().filter(function (c) { return c.selected; });
}

/** 옵션에 맞는 범위 */
function rangeFor(o) {
  return resolveExportRange({
    mode: o.mode, clips: allClips(), loop: snap.loop, selected: selectedClips(),
    fromBar: o.fromBar, toBar: o.toBar, ticksPerBar: TICKS_PER_BAR,
  });
}

/** "bar 5 – 9 · 0:08" 같은 범위 설명 (끝 마디는 걸친 마디까지 포함) */
function describeRange(range) {
  const a = Math.floor(range.startTick / TICKS_PER_BAR) + 1;
  const b = Math.max(a, Math.ceil(range.endTick / TICKS_PER_BAR));
  return 'bar ' + a + ' – ' + b + ' · ' + formatDuration(rangeSeconds(range.startTick, range.endTick, snap.bpm, snap.tempoChanges));
}

/** 범위를 못 구했을 때 창에 띄울 안내 */
function reasonText(reason) {
  if (reason === 'empty') return 'The project is empty. Add a clip first.';
  if (reason === 'no-loop') return 'There is no loop region. Turn on the loop first.';
  if (reason === 'no-selection') return 'No clips are selected. Select clips on the timeline first.';
  return 'Enter a start bar and an end bar (the end must not be before the start).';
}

/** 모든 트랙의 이펙트와 악기 층을 모아 꼬리 "Auto" 값을 계산 */
function computeAutoTail() {
  const effects = [];
  const layers = [];
  snap.tracks.forEach(function (t) {
    (snap.getEffects(t.track_id) || []).forEach(function (e) { effects.push(e); });
    (snap.getInstruments(t.track_id) || []).forEach(function (l) { layers.push(l); });
  });
  return autoTailSeconds(effects, layers, snap.bpm);
}

/** 세 화면(form | progress | done) 중 하나만 보이게 */
function showView(name) {
  document.getElementById('ex-form').hidden = name !== 'form';
  document.getElementById('ex-progress').hidden = name !== 'progress';
  document.getElementById('ex-done').hidden = name !== 'done';
  document.getElementById('ex-foot-form').hidden = name !== 'form';
  document.getElementById('ex-foot-progress').hidden = name !== 'progress';
  document.getElementById('ex-foot-done').hidden = name !== 'done';
  document.getElementById('export-title').textContent = name === 'progress' ? '⤓ Exporting…' : '⤓ Export audio';
}

/**
 * 설정 화면을 지금 값에 맞게 다시 그림 — 범위 설명, 꺼야 할 항목, 요약 줄, 내보내기 버튼
 */
function refreshForm() {
  if (!snap) return;
  const o = readOptions();

  // 범위별 설명과 사용 가능 여부
  const all = rangeFor({ mode: 'all', fromBar: o.fromBar, toBar: o.toBar });
  document.getElementById('ex-len-all').textContent = all.ok ? describeRange(all) : 'Nothing to export yet';
  const loop = rangeFor({ mode: 'loop', fromBar: o.fromBar, toBar: o.toBar });
  document.getElementById('ex-len-loop').textContent = loop.ok ? describeRange(loop) : 'No loop region';
  const sel = rangeFor({ mode: 'selected', fromBar: o.fromBar, toBar: o.toBar });
  const selCount = selectedClips().length;
  document.getElementById('ex-len-selected').textContent = sel.ok ? selCount + (selCount === 1 ? ' clip · ' : ' clips · ') + describeRange(sel) : 'Select clips on the timeline first';
  const custom = rangeFor({ mode: 'custom', fromBar: o.fromBar, toBar: o.toBar });
  document.getElementById('ex-len-custom').textContent = custom.ok ? describeRange(custom) : '—';

  const loopRadio = document.querySelector('input[name="ex-range"][value="loop"]');
  const selRadio = document.querySelector('input[name="ex-range"][value="selected"]');
  loopRadio.disabled = !loop.ok;
  selRadio.disabled = !sel.ok;
  document.getElementById('ex-opt-loop').classList.toggle('is-off', !loop.ok);
  document.getElementById('ex-opt-selected').classList.toggle('is-off', !sel.ok);
  if ((o.mode === 'loop' && !loop.ok) || (o.mode === 'selected' && !sel.ok)) {
    document.querySelector('input[name="ex-range"][value="all"]').checked = true;
    o.mode = 'all';
  }
  document.getElementById('ex-from').disabled = o.mode !== 'custom';
  document.getElementById('ex-to').disabled = o.mode !== 'custom';
  document.getElementById('ex-custom').classList.toggle('is-off', o.mode !== 'custom');
  document.getElementById('ex-selected-note').hidden = o.mode !== 'selected';

  // 비트 깊이 안내와 정규화 칸
  document.getElementById('ex-depth-note').textContent = o.bitDepth === 16
    ? '16-bit adds a little dither noise so quiet tails stay smooth.'
    : (o.bitDepth === 24 ? '24-bit keeps more detail for further mixing.' : '32-bit float cannot clip inside the file and is best for further editing.');
  document.getElementById('ex-norm-db').disabled = !o.normalize;

  // 요약 줄과 내보내기 버튼
  const range = rangeFor(o);
  const msg = document.getElementById('ex-msg');
  if (range.ok) {
    const seconds = rangeSeconds(range.startTick, range.endTick, snap.bpm, snap.tempoChanges) + o.tailSec;
    const frames = Math.ceil(seconds * o.sampleRate);
    document.getElementById('ex-sum-len').textContent = formatDuration(seconds);
    document.getElementById('ex-sum-fmt').textContent = 'WAV · ' + (o.sampleRate / 1000) + ' kHz · ' + (o.bitDepth === 32 ? '32-bit float' : o.bitDepth + '-bit') + ' stereo';
    document.getElementById('ex-sum-size').textContent = '≈ ' + formatBytes(wavByteLength(frames, 2, o.bitDepth));
    msg.hidden = true;
  } else {
    document.getElementById('ex-sum-len').textContent = '—';
    document.getElementById('ex-sum-fmt').textContent = '—';
    document.getElementById('ex-sum-size').textContent = '—';
    msg.textContent = reasonText(range.reason);
    msg.hidden = false;
  }
  document.getElementById('ex-go').disabled = !range.ok;
}

/**
 * 창을 엶 — 지금 화면의 스냅샷을 찍고 기본값을 채움
 * - 마지막으로 고른 샘플레이트와 비트 깊이는 기억해 두었다가 씁니다. 처음이면 프로젝트의 샘플레이트(44.1k 또는 48k)를 따릅니다
 * - 범위는 늘 "전체"로 시작합니다 (클립이 선택되어 있어도): 모르고 일부만 내보내는 일을 막으려고
 */
export function openExport() {
  const dlg = document.getElementById('export-modal');
  if (!dlg || dlg.open) return;
  snap = exportSnapshot();
  result = null;
  rendering = false;
  cancelFlag = false;

  const prefs = loadPrefs();
  const projectRate = Number(document.body.dataset.sampleRate) === 48000 ? 48000 : 44100;
  pickSegment('ex-rate', 'rate', prefs.sampleRate === 48000 || prefs.sampleRate === 44100 ? prefs.sampleRate : projectRate);
  pickSegment('ex-depth', 'depth', [16, 24, 32].indexOf(prefs.bitDepth) >= 0 ? prefs.bitDepth : 16);
  document.getElementById('ex-norm').checked = !!prefs.normalize;
  document.getElementById('ex-norm-db').value = String(clampNumber(prefs.normalizeDb, -12, 0, -0.3));

  document.querySelector('input[name="ex-range"][value="all"]').checked = true;
  const all = rangeFor({ mode: 'all' });
  document.getElementById('ex-from').value = '1';
  document.getElementById('ex-to').value = String(all.ok ? Math.max(1, Math.ceil(all.endTick / TICKS_PER_BAR)) : 1);
  document.getElementById('ex-tail').value = String(computeAutoTail());
  document.getElementById('ex-file').value = exportFileName(document.body.dataset.projectTitle, new Date());

  showView('form');
  refreshForm();
  dlg.showModal();
}

/** 진행률 막대와 글자를 갱신 (0~1) */
function setProgress(p) {
  const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
  document.getElementById('ex-pct').textContent = pct + '%';
  document.getElementById('ex-bar-fill').style.width = pct + '%';
  const elapsed = (Date.now() - startedAt) / 1000;
  if (p > 0.1 && p < 1) {
    const left = Math.max(1, Math.round(elapsed * (1 - p) / p));
    document.getElementById('ex-prog-note').textContent = 'About ' + left + (left === 1 ? ' second' : ' seconds') + ' left. Keep this window open. You can stop it at any time.';
  }
}

/** 한 프레임 쉬어서 화면이 먼저 그려지게 함 (긴 계산 전에 안내 글자를 보여 주려고) */
function nextFrame() {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

/**
 * 내보내기 시작 — 렌더링 → (정규화) → WAV 인코딩 → 완료 화면
 * 중지하면 설정 화면으로 돌아가고, 실패하면 설정 화면에 이유를 보여 줍니다.
 */
async function startExport() {
  const o = readOptions();
  const range = rangeFor(o);
  if (!range.ok || rendering) return;
  savePrefs(o);
  rendering = true;
  cancelFlag = false;
  startedAt = Date.now();
  document.getElementById('ex-stop').disabled = false;
  document.getElementById('ex-prog-title').textContent = 'Rendering…';
  document.getElementById('ex-prog-note').textContent = 'Keep this window open. You can stop it at any time.';
  setProgress(0);
  showView('progress');

  let audio = snap.audioClips;
  let midi = snap.midiClips;
  if (o.mode === 'selected') {
    audio = audio.filter(function (c) { return c.selected; });
    midi = midi.filter(function (c) { return c.selected; });
  }

  try {
    const out = await renderOffline({
      tracks: snap.tracks, audioClips: audio, midiClips: midi,
      getInstruments: snap.getInstruments, getEffects: snap.getEffects,
      bpm: snap.bpm, tempoChanges: snap.tempoChanges,
      startTick: range.startTick, endTick: range.endTick, tailSec: o.tailSec, sampleRate: o.sampleRate,
      loadSampleBytes: snap.loadSampleBytes,
      onProgress: setProgress,
      isCancelled: function () { return cancelFlag; },
    });
    document.getElementById('ex-prog-title').textContent = 'Writing the file…';
    await nextFrame();
    const peak = peakOfChannels(out.channels);
    const gain = o.normalize ? normalizeGain(peak, o.normalizeDb) : 1;
    const bytes = encodeWav(out.channels, out.sampleRate, o.bitDepth, { gain: gain, dither: true });
    result = { bytes: bytes, fileName: o.fileName };

    document.getElementById('ex-done-name').textContent = o.fileName + '.wav';
    document.getElementById('ex-done-meta').textContent = formatDuration(out.frames / out.sampleRate) + ' · ' + formatBytes(bytes.length);
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    if (peak > 0) {
      const peakDb = 20 * Math.log10(peak * gain);
      document.getElementById('ex-done-note').textContent = 'Peak ' + peakDb.toFixed(1) + ' dBFS · rendered in ' + seconds + (seconds === 1 ? ' second' : ' seconds')
        + (peak * gain > 1 ? ' · The mix is louder than 0 dBFS and may clip (turn on Normalize or lower the master).' : '');
    } else {
      document.getElementById('ex-done-note').textContent = 'No sound was rendered. Check that the tracks are not muted and that clips are inside the range.';
    }
    showView('done');
  } catch (err) {
    showView('form');
    refreshForm();
    if (!(err && err.message === 'cancelled')) {
      const msg = document.getElementById('ex-msg');
      msg.textContent = 'Export failed: ' + (err && err.message ? err.message : 'unknown error');
      msg.hidden = false;
      if (window.console) console.warn('[export] 렌더링에 실패했습니다', err);
    }
  } finally {
    rendering = false;
  }
}

/** 중지 버튼 — 다음 시간 창에서 멈추고 설정 화면으로 돌아감 */
function stopExport() {
  if (!rendering) return;
  cancelFlag = true;
  document.getElementById('ex-stop').disabled = true;
  document.getElementById('ex-prog-title').textContent = 'Stopping…';
}

/** 완성된 WAV 를 내려받게 함 (파일명은 설정 화면의 이름 + .wav) */
function downloadResult() {
  if (!result) return;
  const blob = new Blob([result.bytes], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.fileName + '.wav';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
}

/** 창을 닫음 (렌더링 중이면 먼저 멈춤) */
export function closeExport() {
  const dlg = document.getElementById('export-modal');
  if (rendering) stopExport();
  if (dlg && dlg.open) dlg.close();
  result = null;
}

/**
 * 내보내기 창을 화면에 연결 (한 번만 부름)
 * - 명령 file.export (메뉴 · 팔레트 · ⤓ 버튼 · Ctrl+Shift+R) 를 등록합니다
 * - 값이 바뀔 때마다 요약 줄을 다시 계산하고, 렌더링 중 Esc 는 닫지 않고 중지로 받습니다
 */
export function initExport() {
  const dlg = document.getElementById('export-modal');
  if (!dlg) return;
  registerCommand('file.export', openExport, { label: 'Export audio…', group: 'file', keys: 'Ctrl+Shift+R' });

  dlg.addEventListener('click', function (e) {
    const rate = e.target.closest('#ex-rate button[data-rate]');
    const depth = e.target.closest('#ex-depth button[data-depth]');
    if (rate) { pickSegment('ex-rate', 'rate', rate.dataset.rate); refreshForm(); }
    if (depth) { pickSegment('ex-depth', 'depth', depth.dataset.depth); refreshForm(); }
  });
  dlg.addEventListener('input', refreshForm);
  dlg.addEventListener('change', refreshForm);
  document.getElementById('ex-tail-auto').addEventListener('click', function () {
    if (!snap) return;
    document.getElementById('ex-tail').value = String(computeAutoTail());
    refreshForm();
  });
  document.getElementById('ex-go').addEventListener('click', startExport);
  document.getElementById('ex-stop').addEventListener('click', stopExport);
  document.getElementById('ex-download').addEventListener('click', downloadResult);
  document.getElementById('ex-cancel').addEventListener('click', closeExport);
  document.getElementById('ex-close').addEventListener('click', closeExport);
  document.getElementById('ex-x').addEventListener('click', closeExport);
  dlg.addEventListener('cancel', function (e) {
    if (rendering) { e.preventDefault(); stopExport(); }
  });
}
