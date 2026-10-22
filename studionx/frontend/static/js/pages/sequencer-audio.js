// 시퀀서 화면 ↔ 오디오 연결 (S1-11a, PRD 02 FR-201 · FR-205 · FR-251)
// 화면의 값(트랙 줄 · 클립 · BPM · Loop)을 모아 PlaybackSession 에 넘기고,
// 재생 버튼(▶ ⏸ ■)이 실제 소리를 내게 합니다. 소리 계산은 audio/ 폴더가 맡고, 이 파일은 DOM 만 읽습니다.

import { PlaybackSession } from '../audio/session.js';
import { PPQ } from '../audio/timing.js';
import { samplerSampleIds } from '../audio/sampler.js';
import { collectSampleIds } from './sequencer-loader.js';
import { fetchSampleFileUrl } from '../core/api.js';
import { TICKS_PER_BAR, setTransportHooks, setTempoChangesSource, getLoop } from './sequencer-arrange.js';
import {
  playbackTracks, clipRecord, patternNotes, playbackInstruments, playbackEffects, playbackTempoChanges,
  setMeterSource, startMeters,
} from './sequencer-devices.js';

let session = null;
let refreshTimer = null;

/** 상단 #bpm 글자에서 BPM 읽기 (없으면 120) */
function currentBpm() {
  const chip = document.getElementById('bpm');
  const v = chip ? parseFloat(chip.textContent) : NaN;
  return isFinite(v) && v > 0 ? v : 120;
}

/**
 * 화면의 오디오 클립을 서버 클립 모양으로 모음 (재생 시작 시점의 스냅샷)
 * - 위치와 길이는 화면(끌어서 옮긴 값)을 따르고, gain · 루프 · 음정은 서버 기록을 따릅니다
 * - 아직 저장되지 않은 트랙(번호가 숫자가 아님)과 샘플이 없는 클립은 건너뜁니다
 * @returns {Array<object>}
 */
function collectAudioClips() {
  const list = [];
  Array.prototype.forEach.call(document.querySelectorAll('.sq-clip--audio'), function (el) {
    const trackRow = el.closest('.sq-track');
    const trackId = trackRow ? Number(trackRow.dataset.trackId) : NaN;
    const sampleId = el.dataset.sampleId ? Number(el.dataset.sampleId) : NaN;
    if (!isFinite(trackId) || !isFinite(sampleId)) return;
    const rec = el.dataset.clipId ? clipRecord(el.dataset.clipId) : null;
    const startBar = parseFloat(el.style.getPropertyValue('--s')) || 0;
    const lengthBar = parseFloat(el.style.getPropertyValue('--l')) || 0;
    const offsetBar = parseFloat(el.style.getPropertyValue('--o')) || 0;
    if (lengthBar <= 0) return;
    list.push({
      clip_id: el.dataset.clipId ? Number(el.dataset.clipId) : null,
      selected: el.classList.contains('is-selected'),    // 내보내기의 "선택한 클립" 범위가 씀 (S1-11b)
      track_id: trackId,
      sample_id: sampleId,
      start_tick: Math.round(startBar * TICKS_PER_BAR),
      length_tick: Math.round(lengthBar * TICKS_PER_BAR),
      offset_tick: Math.round(offsetBar * TICKS_PER_BAR),
      gain_db: rec ? Number(rec.gain_db) || 0 : 0,
      is_looped: rec ? !!rec.is_looped : false,
      pitch_semitones: rec ? Number(rec.pitch_semitones) || 0 : 0,
    });
  });
  return list;
}

/**
 * 화면의 MIDI 클립을 노트와 함께 모음 (재생 시작 시점의 스냅샷)
 * - 피아노롤에서 고친 클립은 화면이 가진 노트(__notes)를, 아니면 서버가 준 패턴의 노트를 씁니다
 * @returns {Array<object>}
 */
function collectMidiClips() {
  const list = [];
  Array.prototype.forEach.call(document.querySelectorAll('.sq-clip--midi'), function (el) {
    const trackRow = el.closest('.sq-track');
    const trackId = trackRow ? Number(trackRow.dataset.trackId) : NaN;
    if (!isFinite(trackId)) return;
    const startBar = parseFloat(el.style.getPropertyValue('--s')) || 0;
    const lengthBar = parseFloat(el.style.getPropertyValue('--l')) || 0;
    const offsetBar = parseFloat(el.style.getPropertyValue('--o')) || 0;
    if (lengthBar <= 0) return;
    const notes = el.__notes ? el.__notes : (el.dataset.patternId ? patternNotes(el.dataset.patternId) : []);
    list.push({
      selected: el.classList.contains('is-selected'),
      track_id: trackId,
      start_tick: Math.round(startBar * TICKS_PER_BAR),
      length_tick: Math.round(lengthBar * TICKS_PER_BAR),
      offset_tick: Math.round(offsetBar * TICKS_PER_BAR),
      notes: notes,
    });
  });
  return list;
}

/** 샘플 파일을 서버에서 받음 (토큰을 붙여 받은 blob 주소를 다시 읽음) */
function fetchSampleBytes(sampleId) {
  return fetchSampleFileUrl(sampleId).then(function (url) { return fetch(url); })
    .then(function (res) { return res.arrayBuffer(); });
}

/* ───────────── 샘플 미리 받기 (S1-14) — 로딩 화면이 프로젝트를 열 때 샘플 파일을 먼저 받아 둡니다 ───────────── */

/** 미리 받은 샘플 파일 (샘플 번호 → ArrayBuffer). 재생이나 내보내기가 처음 부를 때 한 번 넘겨주고 지웁니다 */
const preloaded = {};
let preloadedBytes = 0;
/** 미리 받아 둘 총량의 한도 — 넘으면 받기는 하되 메모리에 두지 않고 버림 (재생 때 다시 받음) */
const PRELOAD_CAP_BYTES = 256 * 1024 * 1024;
/** 샘플 하나를 기다리는 최대 시간 — 넘으면 건너뛰고 열어서 로딩이 멈추지 않게 함 */
const PRELOAD_TIMEOUT_MS = 20000;
const PRELOAD_PARALLEL = 3;

/** 샘플 번호 → 파일 바이트. 로딩 때 미리 받아 둔 것이 있으면 그것을 한 번 넘겨주고, 없으면 서버에서 받음 */
function loadSampleBytes(sampleId) {
  const key = String(sampleId);
  const hit = preloaded[key];
  if (hit) {
    delete preloaded[key];
    preloadedBytes -= hit.byteLength;
    return Promise.resolve(hit);
  }
  return fetchSampleBytes(sampleId);
}

/** 샘플 하나를 받아 담아 둠. 시간이 지나면 거절 */
function preloadOne(sampleId) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    const timer = window.setTimeout(function () {
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, PRELOAD_TIMEOUT_MS);
    fetchSampleBytes(sampleId).then(function (bytes) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (preloadedBytes + bytes.byteLength <= PRELOAD_CAP_BYTES) {
        preloaded[String(sampleId)] = bytes;
        preloadedBytes += bytes.byteLength;
      }
      resolve();
    }, function (err) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 프로젝트가 쓰는 샘플 번호 모으기 — 오디오 클립의 샘플과 Sampler 악기의 샘플, 중복 없이
 * @param {object} data  GET /projects/{id}/full 의 응답
 * @returns {number[]}
 */
export function projectSampleIds(data) {
  const trackIds = ((data && data.tracks) || []).map(function (t) { return t.track_id; });
  return collectSampleIds(data ? data.clips : [], samplerSampleIds(playbackInstruments, trackIds));
}

/**
 * 샘플 파일을 미리 받아 둠 (한 번에 세 개씩). 하나가 실패하거나 늦어도 나머지는 계속합니다
 * @param {number[]} ids
 * @param {function(number, number):void} [onStep]  하나가 끝날 때마다 (끝난 수, 전체 수) — 실패한 것도 끝난 것으로 셈
 * @returns {Promise<{total:number, loaded:number, failed:number}>}
 */
export function preloadSamples(ids, onStep) {
  const list = (ids || []).slice();
  const total = list.length;
  const step = onStep || function () {};
  return new Promise(function (resolve) {
    if (!total) { resolve({ total: 0, loaded: 0, failed: 0 }); return; }
    let next = 0;
    let done = 0;
    let failed = 0;
    function finishOne(ok) {
      done += 1;
      if (!ok) failed += 1;
      step(done, total);
      if (done === total) resolve({ total: total, loaded: total - failed, failed: failed });
      else pump();
    }
    function pump() {
      if (next >= total) return;
      const id = list[next];
      next += 1;
      preloadOne(id).then(function () { finishOne(true); }, function () { finishOne(false); });
    }
    for (let i = 0; i < Math.min(PRELOAD_PARALLEL, total); i += 1) pump();
  });
}

/** 미리 받아 둔 샘플 수와 바이트 (시험용) */
export function preloadState() {
  return { count: Object.keys(preloaded).length, bytes: preloadedBytes };
}

/** 세션을 처음 쓸 때 만듦 */
function getSession() {
  if (session) return session;
  session = new PlaybackSession({
    getTracks: playbackTracks,
    getClips: collectAudioClips,
    getMidiClips: collectMidiClips,
    getInstruments: playbackInstruments,
    getEffects: playbackEffects,
    getBpm: currentBpm,
    getTempoChanges: playbackTempoChanges,
    getLoop: function () {
      const loop = getLoop();
      if (!loop.on || !(loop.length > 0)) return null;
      return { start: Math.round(loop.start * TICKS_PER_BAR), end: Math.round((loop.start + loop.length) * TICKS_PER_BAR) };
    },
    loadSampleBytes: loadSampleBytes,
  });
  return session;
}

/** 재생 중에만 믹서 값을 자주 다시 반영 (M · S 버튼, 볼륨 · 팬 노브 조작이 바로 들리도록) */
function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(function () { if (session) session.refreshMixer(); }, 150);
}
function stopRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

/**
 * 내보내기에 넘길 지금 화면의 스냅샷 (S1-11b) — 재생 시작 때 모으는 것과 같은 값
 * @returns {object} tracks, audioClips, midiClips, getInstruments, getEffects, bpm, loop(tick 또는 null), loadSampleBytes
 */
export function exportSnapshot() {
  const loop = getLoop();
  return {
    tracks: playbackTracks(),
    audioClips: collectAudioClips(),
    midiClips: collectMidiClips(),
    getInstruments: playbackInstruments,
    getEffects: playbackEffects,
    bpm: currentBpm(),
    tempoChanges: playbackTempoChanges(),
    loop: loop.on && loop.length > 0
      ? { start: Math.round(loop.start * TICKS_PER_BAR), end: Math.round((loop.start + loop.length) * TICKS_PER_BAR) }
      : null,
    loadSampleBytes: loadSampleBytes,
  };
}

/** 지금 재생 세션 (시험용 — 헤드리스 시험이 마스터 출력을 엿볼 때 씀). 아직 재생한 적이 없으면 null */
export function audioSession() {
  return session;
}

/**
 * 재생 버튼을 소리에 연결 (한 번만 부름)
 * - ▶ : 현재 위치(마디)부터 재생. 샘플 불러오기에 실패해도 화면 재생선은 그대로 움직입니다
 * - ⏸ · ■ : 소리를 끊음
 */
export function initAudio() {
  setTempoChangesSource(playbackTempoChanges);    // 재생선과 시간 표시도 소리와 같은 템포 지도를 따름 (S1-13)
  setTransportHooks({
    onPlay: function (bar) {
      const s = getSession();
      startMeters();
      s.start(Math.round(bar * TICKS_PER_BAR)).then(startRefresh).catch(function (err) {
        if (window.console) console.warn('[audio] 재생을 시작하지 못했습니다', err);
      });
    },
    onPause: function () {
      stopRefresh();
      if (session) session.pause();
    },
  });
  // 미터 막대가 진짜 소리 크기를 읽게 함 (세션이 아직 없으면 null → 막대는 0 으로 내려감)
  setMeterSource(function (trackId) { return session ? session.meterLevels(trackId) : null; });
  if (window.console) console.debug('[audio] connected, PPQ', PPQ);
}
