// 시퀀서 화면 ↔ 오디오 연결 (S1-11a, PRD 02 FR-201 · FR-205 · FR-251)
// 화면의 값(트랙 줄 · 클립 · BPM · Loop)을 모아 PlaybackSession 에 넘기고,
// 재생 버튼(▶ ⏸ ■)이 실제 소리를 내게 합니다. 소리 계산은 audio/ 폴더가 맡고, 이 파일은 DOM 만 읽습니다.

import { PlaybackSession } from '../audio/session.js';
import { PPQ } from '../audio/timing.js';
import { fetchSampleFileUrl } from '../core/api.js';
import { TICKS_PER_BAR, setTransportHooks, getLoop } from './sequencer-arrange.js';
import { playbackTracks, clipRecord, patternNotes, playbackInstruments, playbackEffects, setMeterSource, startMeters } from './sequencer-devices.js';

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

/** 샘플 번호 → 파일 바이트 (토큰을 붙여 받은 blob 주소를 다시 읽음) */
function loadSampleBytes(sampleId) {
  return fetchSampleFileUrl(sampleId).then(function (url) { return fetch(url); })
    .then(function (res) { return res.arrayBuffer(); });
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
    tempoChanges: [],
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
