// 시퀀서 — Sampler 의 샘플 고르기 (S1-11c, PRD 02 FR-241)
// 설명: docs/ai-notes/javascript/S1-11c - Sampler MIDI 연주/
//
// 맡는 것
// - 라이브러리의 샘플 목록을 읽어 두기 (카드의 샘플 이름, 상세 창의 이름 · 길이 · 샘플레이트)
// - 상세 창의 Sample 줄: 이름 · 정보 · Change… 버튼, 파형과 Root 표시, 라이브러리 고르기 창(검색 · 미리 듣기),
//   브라우저의 샘플을 파형에 끌어 놓기 (목업 docs/page_mockups/sampler/)
// - 카드의 부제(샘플 이름 · 모드)와 샘플이 없을 때의 경고 문구
// - One-Shot 모드에서 무시되는 칸(Loop, Sustain, Release) 알려 주기
// 순수한 계산(노트 이름, 무시되는 칸, 부제 글)은 DOM 없이도 시험할 수 있게 따로 둡니다.

import { fetchSampleList, fetchSampleWaveform, fetchSampleFileUrl } from '../core/api.js';

/** 브라우저의 샘플을 끌 때 쓰는 형식 (sequencer-arrange.js 의 DND_TYPE 과 같은 값) */
const DND_TYPE = 'application/x-studionx-clip';
/** 목록을 한 쪽에 받는 개수(서버 최대) 와 최대 쪽 수 */
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 샘플 목록 (GET /samples) — 한 번 읽어 담아 둠 */
let library = [];
let loading = null;
/** sampleId -> peaks (파형 요청은 샘플마다 한 번만) */
const peaksCache = {};
/** 미리 듣기용 재생기 (하나만 둠) */
let previewAudio = null;

/** Sampler 플러그인인지 */
export function isSampler(plugin) {
  return !!plugin && plugin.code === 'sampler';
}

/**
 * MIDI 노트 번호 → 이름 (순수 함수). 60 = C4
 * @param {number} n
 * @returns {string} 예: 'C4', 'F#3'
 */
export function noteName(n) {
  const v = Math.round(Number(n) || 0);
  return NOTE_NAMES[((v % 12) + 12) % 12] + (Math.floor(v / 12) - 1);
}

/**
 * One-Shot 모드에서 무시되는 칸의 key 목록 (순수 함수)
 * @param {string} mode  'classic' | 'oneshot'
 * @returns {string[]}
 */
export function ignoredKeys(mode) {
  return mode === 'oneshot' ? ['loop', 'sustain', 'release'] : [];
}

/**
 * 카드 부제 (순수 함수) — 샘플이 있으면 "이름 · 모드", 없으면 경고
 * @param {object|null} info  샘플 정보({name}) 또는 null
 * @param {number|string|null} sampleId  악기에 붙은 샘플 번호
 * @param {string} modeLabel  'Classic' | 'One-Shot'
 * @returns {{empty:boolean, text:string}}
 */
export function cardSubtitle(info, sampleId, modeLabel) {
  if (sampleId == null || sampleId === '') return { empty: true, text: 'No sample chosen. Notes make no sound.' };
  const name = info ? info.name : 'Sample #' + sampleId;
  return { empty: false, text: name + ' · ' + modeLabel };
}

/**
 * 샘플 정보 한 줄 (순수 함수) — "0:01 · 44.1 kHz · mono"
 * @param {object|null} info  SampleResponse
 * @returns {string}
 */
export function sampleInfoText(info) {
  if (!info) return '';
  const parts = [];
  if (info.duration_ms) {
    const sec = Math.round(info.duration_ms / 1000);
    parts.push(Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60));
  }
  if (info.sample_rate) parts.push((info.sample_rate / 1000) + ' kHz');
  if (info.channels) parts.push(info.channels === 1 ? 'mono' : (info.channels === 2 ? 'stereo' : info.channels + ' ch'));
  return parts.join(' · ');
}

/** HTML 에 넣을 글 안전하게 */
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
  });
}

/**
 * 샘플 목록 읽기 — 이미 읽었으면 그대로 돌려줌. 실패하면 빈 목록(카드는 "Sample #번호" 로 보임)
 * @param {boolean} [force]  true 면 다시 읽음 (고르기 창을 열 때)
 * @returns {Promise<object[]>}
 */
export function loadSampleLibrary(force) {
  if (loading && !force) return loading;
  loading = (async function () {
    const all = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const res = await fetchSampleList({ page: page, size: PAGE_SIZE });
      const items = res && res.items ? res.items : [];
      items.forEach(function (it) { all.push(it); });
      if (all.length >= (res ? res.total : 0) || !items.length) break;
    }
    library = all;
    return library;
  }()).catch(function (err) {
    loading = null;
    if (window.console) console.warn('[sampler] 샘플 목록을 읽지 못했습니다', err);
    return library;
  });
  return loading;
}

/** 번호로 샘플 정보 찾기 (목록을 아직 못 읽었으면 null) */
export function sampleInfoOf(sampleId) {
  if (sampleId == null || sampleId === '') return null;
  const found = library.filter(function (s) { return String(s.sample_id) === String(sampleId); })[0];
  return found || null;
}

/**
 * Sample 줄 한 칸의 HTML (상세 창, type "sample")
 * @param {object} item   param_schema 항목
 * @param {number|string|null} value  고른 샘플 번호
 * @param {number} rootNote  Root 노브 값 (파형 위 표시)
 * @returns {string}
 */
export function samplePickHtml(item, value, rootNote) {
  const has = value != null && value !== '';
  const info = has ? sampleInfoOf(value) : null;
  const name = has ? (info ? info.name : 'Sample #' + value) : 'No sample chosen';
  const meta = has ? sampleInfoText(info) : '';
  return '<div class="sq-param sq-param--wide sq-samp' + (has ? '' : ' is-empty') + '" data-param-cell="' + esc(item.key) + '">'
    + '<span class="sq-samp__label">' + esc(item.name) + '</span>'
    + '<div class="sq-samp__row">'
    + '<span class="sq-samp__icon" aria-hidden="true">♫</span>'
    + '<span class="sq-samp__name">' + esc(name) + '</span>'
    + '<span class="sq-samp__meta sq-num">' + esc(meta) + '</span>'
    + '<button type="button" class="sq-dialog__btn" data-samp="change">' + (has ? 'Change…' : 'Choose…') + '</button></div>'
    + (has
      ? '<div class="sq-samp__wave" data-samp="wave"><canvas width="560" height="56" aria-label="Waveform of ' + esc(name) + '"></canvas>'
        + '<span class="sq-samp__root">Root ' + esc(noteName(rootNote)) + '</span></div>'
      : '<p class="sq-samp__warn">⚠ No sample chosen. Notes make no sound.</p>'
        + '<p class="sq-samp__drophint">Drag a sample here from the browser, or press Choose…</p>')
    + '<div class="sq-samp__pick" data-samp="pick" hidden>'
    + '<strong>Choose a sample from your library</strong>'
    + '<input type="search" data-samp="search" placeholder="Search samples…" aria-label="Search samples">'
    + '<ul data-samp="list"></ul>'
    + '<small>You can also drag a sample from the browser onto the waveform.</small></div>'
    + '</div>';
}

/** 고르기 창의 목록을 검색어로 거르며 그리기 */
function renderPickList(cell, query, selectedId) {
  const list = cell.querySelector('[data-samp="list"]');
  if (!list) return;
  const q = String(query || '').trim().toLowerCase();
  const found = library.filter(function (s) { return !q || String(s.name).toLowerCase().indexOf(q) >= 0; });
  if (!found.length) {
    list.innerHTML = '<li class="sq-samp__none">' + (library.length ? 'No sample matches.' : 'Your library is empty. Upload a sample in the browser first.') + '</li>';
    return;
  }
  list.innerHTML = found.map(function (s) {
    const tag = s.tags && s.tags.length ? ' · ' + esc(s.tags[0].name) : '';
    return '<li><button type="button" class="sq-samp__item' + (String(s.sample_id) === String(selectedId) ? ' is-on' : '') + '" data-sample-id="' + s.sample_id + '">'
      + '<span aria-hidden="true">♫</span><span class="sq-samp__iname">' + esc(s.name) + '</span>'
      + '<span class="sq-samp__imeta sq-num">' + esc(sampleInfoText(s).split(' · ')[0] || '') + tag + '</span></button>'
      + '<button type="button" class="sq-samp__prev" data-preview="' + s.sample_id + '" aria-label="Preview ' + esc(s.name) + '">▶</button></li>';
  }).join('');
}

/** 미리 듣기 — 같은 샘플을 다시 누르면 멈춤 */
async function previewSample(sampleId) {
  if (previewAudio) {
    const same = previewAudio.dataset.sampleId === String(sampleId);
    previewAudio.pause();
    previewAudio = null;
    if (same) return;
  }
  const url = await fetchSampleFileUrl(sampleId);
  previewAudio = new Audio(url);
  previewAudio.dataset.sampleId = String(sampleId);
  previewAudio.addEventListener('ended', function () { previewAudio = null; });
  await previewAudio.play();
}

/** 상세 창을 닫을 때 미리 듣기를 끔 */
export function stopSamplePreview() {
  if (previewAudio) { previewAudio.pause(); previewAudio = null; }
}

/** 파형 그리기 — 서버가 준 peaks([최솟값, 최댓값] 쌍)를 캔버스에 세로선으로 */
async function paintWave(cell, sampleId) {
  const canvas = cell.querySelector('canvas');
  if (!canvas || !canvas.getContext) return;
  let peaks = peaksCache[sampleId];
  if (!peaks) {
    try {
      const res = await fetchSampleWaveform(sampleId);
      peaks = res && res.peaks ? res.peaks : [];
      peaksCache[sampleId] = peaks;
    } catch (err) {
      return;   // 파형이 없어도 샘플은 울립니다
    }
  }
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = window.getComputedStyle(canvas).color;
  if (!peaks.length) return;
  for (let x = 0; x < w; x += 1) {
    const p = peaks[Math.min(peaks.length - 1, Math.floor(x * peaks.length / w))];
    const lo = Math.max(-1, Math.min(1, Number(p[0]) || 0));
    const hi = Math.max(-1, Math.min(1, Number(p[1]) || 0));
    const y1 = (1 - hi) / 2 * h;
    const y2 = (1 - lo) / 2 * h;
    g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}

/**
 * Sample 줄에 동작 연결 (Change… 버튼, 검색, 고르기, 미리 듣기, 파형에 끌어 놓기)
 * @param {HTMLElement} cell  samplePickHtml 이 만든 칸
 * @param {number|string|null} value  지금 고른 샘플 번호
 * @param {function(number):void} onPick  새 샘플을 고르면 부름
 */
export function bindSamplePick(cell, value, onPick) {
  const pick = cell.querySelector('[data-samp="pick"]');
  const search = cell.querySelector('[data-samp="search"]');
  const change = cell.querySelector('[data-samp="change"]');
  if (value != null && value !== '') paintWave(cell, value);

  change.addEventListener('click', function () {
    const open = pick.hidden;
    pick.hidden = !open;
    if (!open) return;
    renderPickList(cell, '', value);
    loadSampleLibrary(true).then(function () { renderPickList(cell, search.value, value); });
    search.value = '';
    search.focus();
  });
  search.addEventListener('input', function () { renderPickList(cell, search.value, value); });
  pick.addEventListener('click', function (e) {
    const prev = e.target.closest('[data-preview]');
    if (prev) {
      previewSample(prev.getAttribute('data-preview')).catch(function () { /* 재생이 막혀도 고르기는 계속 */ });
      return;
    }
    const item = e.target.closest('[data-sample-id]');
    if (item) {
      stopSamplePreview();
      onPick(Number(item.getAttribute('data-sample-id')));
    }
  });

  // 브라우저의 샘플 줄을 칸 위에 놓으면 그 샘플로 바꿈
  cell.addEventListener('dragover', function (e) {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, DND_TYPE) >= 0) {
      e.preventDefault();
      cell.classList.add('is-drop');
    }
  });
  cell.addEventListener('dragleave', function () { cell.classList.remove('is-drop'); });
  cell.addEventListener('drop', function (e) {
    cell.classList.remove('is-drop');
    if (!e.dataTransfer) return;
    let data = null;
    try { data = JSON.parse(e.dataTransfer.getData(DND_TYPE)); } catch (err) { data = null; }
    if (!data || data.kind !== 'audio' || !data.sampleId) return;
    e.preventDefault();
    onPick(Number(data.sampleId));
  });
}
