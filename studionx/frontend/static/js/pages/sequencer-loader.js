// 시퀀서 로딩 화면 (S1-14) — 목업 docs/page_mockups/sequencer/04~07 (B "Signal in")
// 설명: docs/ai-notes/javascript/S1-14 - 시퀀서 로딩 화면/
//
// 맡는 것
// - 화면을 열 때 덮는 로딩 화면: 진행률만큼 왼쪽부터 파형이 그려지고, 100% 가 되면 SIGNAL IN 이 켜진 뒤
//   클릭 없이 신호선을 따라 위아래로 열립니다 (목업 결정, 2026-10-03). 오디오는 시퀀서 안의 첫 조작 때 시작합니다.
// - 세 가지 경우: 기존 프로젝트(open, 샘플 n/m), 새 프로젝트(new, ?new=1 — 샘플이 없어 더 짧음), 예시 화면(demo, projectId 없음)
// - 계산(진행률 합산, 부드럽게 따라가기, 파형 모양, 문구)은 DOM 없이도 시험할 수 있게 순수 함수로 따로 둡니다.
//
// 로딩 화면의 마크업은 studioNx.html 에 처음부터 들어 있어서 첫 그림부터 보입니다 (예시 화면이 먼저 비치지 않게).
// 이 파일이 실행되지 않아도 CSS 의 안전장치(30초 뒤 저절로 숨김)가 화면을 풀어 줍니다.

const WAVE_HEIGHT = 120;
const NS = 'http://www.w3.org/2000/svg';
/** 로딩이 이 시간을 넘기면 어떤 일이 있어도 엽니다 (샘플이 안 받아져 멈추는 일을 막으려고) */
export const HARD_TIMEOUT_MS = 25000;
/** SIGNAL IN 이 켜진 뒤 열리기 시작하기까지, 그리고 여는 데 걸리는 시간 (목업 0.3초, 0.38초) */
const SIGNAL_HOLD_MS = 280;
const OPEN_MS = 420;

/* ───────────────────────── 순수 함수 (DOM 없이 시험) ───────────────────────── */

/**
 * 로딩 종류 정하기
 * @param {string} search  location.search
 * @param {boolean} hasProject  projectId 가 있는지
 * @returns {'open'|'new'|'demo'}  projectId 가 없으면 demo, ?new=1 이면 new, 그 밖에는 open
 */
export function loaderMode(search, hasProject) {
  if (!hasProject) return 'demo';
  return new URLSearchParams(search || '').get('new') === '1' ? 'new' : 'open';
}

/**
 * 로딩 화면이 적어도 떠 있는 시간(ms) — 너무 빨리 끝나면 화면이 깜빡이기만 하므로
 * 움직임 줄이기 설정이면 기다리지 않습니다
 */
export function minDisplayMs(mode, reducedMotion) {
  if (reducedMotion) return 0;
  if (mode === 'open') return 1600;
  if (mode === 'new') return 1100;
  return 800;
}

/**
 * 단계 계획 — 화면의 세 점(●)과 진행률 비중
 * - data: 프로젝트 데이터, content: 샘플(open) 또는 MASTER 트랙(new, demo), engine: 오디오와 화면 준비
 * - 샘플이 하나도 없는 프로젝트는 content 가 바로 끝나므로 비중을 줄여 진행률이 헛돌지 않게 함
 * @param {'open'|'new'|'demo'} mode
 * @param {number|null} sampleTotal  불러올 샘플 수 (open 에서만 뜻이 있음). 아직 모르면 null → 샘플이 있는 것으로 봄
 * @returns {Array<{id:string, label:string, weight:number}>}
 */
export function stagePlan(mode, sampleTotal) {
  if (mode === 'open') {
    const none = sampleTotal === 0;
    return [
      { id: 'data', label: 'PROJECT DATA', weight: none ? 0.55 : 0.3 },
      { id: 'content', label: none ? 'NO SAMPLES' : 'SAMPLES', weight: none ? 0.1 : 0.55 },
      { id: 'engine', label: 'AUDIO ENGINE', weight: none ? 0.35 : 0.15 },
    ];
  }
  if (mode === 'new') {
    return [
      { id: 'data', label: 'CREATING PROJECT', weight: 0.5 },
      { id: 'content', label: 'MASTER TRACK', weight: 0.3 },
      { id: 'engine', label: 'AUDIO ENGINE', weight: 0.2 },
    ];
  }
  return [
    { id: 'data', label: 'EXAMPLE PROJECT', weight: 0.4 },
    { id: 'content', label: 'TRACKS', weight: 0.4 },
    { id: 'engine', label: 'AUDIO ENGINE', weight: 0.2 },
  ];
}

/**
 * 전체 진행률 (0~1) — 단계마다 (비중 × 진행)을 더해 비중의 합으로 나눔
 * @param {Array<{weight:number, fraction:number}>} stages
 */
export function overallProgress(stages) {
  let sum = 0;
  let total = 0;
  (stages || []).forEach(function (s) {
    const w = Number(s.weight) > 0 ? Number(s.weight) : 0;
    const f = Math.max(0, Math.min(1, Number(s.fraction) || 0));
    sum += w * f;
    total += w;
  });
  return total > 0 ? Math.max(0, Math.min(1, sum / total)) : 0;
}

/**
 * 화면에 그리는 진행률을 실제 진행률 쪽으로 부드럽게 옮김 (프레임마다 한 번 부름)
 * - 실제 진행률(target)을 넘지 않고, 줄어들지도 않습니다
 * - 최소 표시 시간(minMs)이 있으면 그 시간에 비례한 값 이상으로 앞서가지 않습니다 (너무 빨리 100% 가 되지 않게)
 * @param {number} displayed  지금 그려진 값 (0~1)
 * @param {number} target     실제 진행률 (0~1)
 * @param {number} elapsedMs  로딩을 시작한 뒤 흐른 시간
 * @param {number} minMs      최소 표시 시간 (0 이면 제한 없음)
 * @param {number} dtMs       지난 프레임 이후의 시간
 * @returns {number}
 */
export function easeDisplayed(displayed, target, elapsedMs, minMs, dtMs) {
  const cap = minMs > 0 ? Math.min(1, Math.max(0, elapsedMs) / minMs) : 1;
  const goal = Math.min(target, cap);
  if (goal <= displayed) return displayed;
  const next = displayed + (goal - displayed) * (1 - Math.exp(-Math.max(0, dtMs) / 140));
  return goal - next < 0.0005 ? goal : next;
}

/**
 * 신호선 위의 파형 모양 (목업의 식 그대로) — 가운데가 크고 양 끝으로 잦아듦
 * @param {number} width  그릴 너비
 * @param {number} calm   1 = 보통, 작을수록 잔잔 (새 프로젝트는 0.55)
 * @returns {string} SVG path 의 d
 */
export function wavePath(width, calm) {
  const w = Math.max(60, Math.round(width));
  const mid = WAVE_HEIGHT / 2;
  let d = 'M0 ' + mid;
  for (let x = 0; x <= w; x += 6) {
    const env = Math.pow(Math.sin(Math.PI * x / w), 1.4);
    const y = mid - calm * env * (34 * Math.sin(x * 0.09) * Math.sin(x * 0.013 + 1) + 14 * Math.sin(x * 0.31));
    d += ' L' + x + ' ' + y.toFixed(1);
  }
  return d;
}

/**
 * 프로젝트 정보 한 줄 — "128 BPM · 4/4 · A MINOR · 5 TRACKS"
 * 값이 없는 칸은 건너뜁니다. 트랙 수에는 MASTER 를 세지 않습니다.
 * @param {object|null} project  GET /full 의 project
 * @param {number} trackCount
 * @param {'open'|'new'|'demo'} mode  new 이면 트랙 수 대신 "MASTER TRACK ONLY"
 */
export function projectInfoText(project, trackCount, mode) {
  const parts = [];
  if (project) {
    const bpm = Number(project.bpm);
    if (isFinite(bpm) && bpm > 0) parts.push((Math.round(bpm * 100) % 100 === 0 ? String(Math.round(bpm)) : bpm.toFixed(2)) + ' BPM');
    if (project.time_sig_num && project.time_sig_den) parts.push(project.time_sig_num + '/' + project.time_sig_den);
    if (project.music_key) parts.push(String(project.music_key + (project.scale_mode ? ' ' + project.scale_mode : '')).toUpperCase());
  }
  if (mode === 'new') parts.push('MASTER TRACK ONLY');
  else if (trackCount >= 0) parts.push(trackCount + (trackCount === 1 ? ' TRACK' : ' TRACKS'));
  return parts.join(' · ');
}

/**
 * 불러올 샘플 번호 모으기 — 오디오 클립의 샘플과 Sampler 악기의 샘플, 중복 없이
 * @param {Array<{sample_id:number|null}>} clips  GET /full 의 clips
 * @param {Array<number>} samplerIds  samplerSampleIds 의 결과
 * @returns {number[]}
 */
export function collectSampleIds(clips, samplerIds) {
  const out = [];
  const add = function (id) {
    if (id == null || id === '') return;
    const n = Number(id);
    if (isFinite(n) && out.indexOf(n) < 0) out.push(n);
  };
  (clips || []).forEach(function (c) { add(c && c.sample_id); });
  (samplerIds || []).forEach(add);
  return out;
}

/** 샘플 개수 글 — "12/34" */
export function sampleCountText(done, total) {
  return Math.max(0, done) + '/' + Math.max(0, total);
}

/* ───────────────────────── 화면 ───────────────────────── */

/** 아무것도 하지 않는 로딩 (로딩 요소가 없는 화면에서도 같은 방식으로 부를 수 있게) */
function inertLoader() {
  const done = Promise.resolve();
  return {
    setProject: function () {}, setStage: function () {}, setSamples: function () {}, setSampleTotal: function () {},
    fail: function () {}, finish: function () { return done; }, isActive: function () { return false; },
  };
}

/** 움직임 줄이기 설정인지 */
function prefersReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}

/**
 * 로딩 화면 만들기 (페이지에서 한 번)
 * - 마크업(#sq-loader)이 없거나 시험용 표시(window.__snxNoLoader)가 있으면 바로 열린 것처럼 동작합니다
 * @param {{mode:'open'|'new'|'demo'}} options
 * @returns {{
 *   setProject:function({title:string, info:string}):void,
 *   setStage:function(id:string, fraction:number):void,
 *   setSampleTotal:function(total:number):void,
 *   setSamples:function(done:number, total:number):void,
 *   fail:function():void,
 *   finish:function():Promise<void>,
 *   isActive:function():boolean
 * }}
 */
export function createLoader(options) {
  const root = typeof document !== 'undefined' ? document.getElementById('sq-loader') : null;
  const mode = options && options.mode ? options.mode : 'open';
  if (!root) return inertLoader();
  if (typeof window !== 'undefined' && window.__snxNoLoader) {
    // 시험 도구가 화면 조작을 바로 시작할 수 있게 로딩 화면을 보이지 않게 치움 (docs/handoff/p1-28_tests/lib.mjs)
    root.remove();
    return inertLoader();
  }

  const reduced = prefersReducedMotion();
  const minMs = minDisplayMs(mode, reduced);
  const q = function (sel) { return root.querySelector(sel); };
  const els = {
    kind: q('.sq-ld__kind'), name: q('.sq-ld__name'), info: q('.sq-ld__info'), line: q('.sq-ld__line'), wave: q('.sq-ld__wave'),
    flat: q('.sq-ld__flat'), pct: q('.sq-ld__pct'),
    steps: { data: q('[data-step="data"]'), content: q('[data-step="content"]'), engine: q('[data-step="engine"]') },
  };

  let plan = stagePlan(mode, null);
  const fraction = { data: 0, content: 0, engine: 0 };
  let sampleTotal = null;   // 아직 모름 (null) → setSampleTotal 로 정해짐
  let sampleDone = 0;
  let displayed = 0;
  let lastTs = 0;
  let startTs = 0;
  let raf = 0;
  let finishing = false;
  let opened = false;
  let failed = false;
  let resolveFinish = null;
  const finished = new Promise(function (resolve) { resolveFinish = resolve; });
  let active = true;
  let hardTimer = 0;

  // 화면 뒤의 조작 막기: 로딩 중에는 Tab 으로 뒤 화면에 들어가지 못하게 (inert) — 끝나면 우리가 막은 것만 되돌림
  const inerted = [];
  try {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== root && !el.inert) { el.inert = true; inerted.push(el); }
    });
  } catch (e) { /* inert 를 모르는 브라우저는 건너뜀 */ }

  // 종류별 문구
  if (els.kind) els.kind.textContent = mode === 'new' ? 'NEW PROJECT' : (mode === 'demo' ? 'EXAMPLE SCREEN' : 'OPENING PROJECT');
  root.classList.add('is-' + mode);
  if (reduced) root.classList.add('is-reduced');

  // 신호선: 화면 너비에 맞춘 viewBox 와 파형 (너비가 달라지면 다시 그림)
  function drawLine() {
    if (!els.line || !els.wave) return;
    const w = Math.max(320, Math.round(root.clientWidth || window.innerWidth || 1440));
    els.line.setAttribute('viewBox', '0 0 ' + w + ' ' + WAVE_HEIGHT);
    if (els.flat) { els.flat.setAttribute('x2', String(w)); }
    els.wave.setAttribute('d', wavePath(w, mode === 'open' ? 1 : 0.55));
  }
  drawLine();
  window.addEventListener('resize', drawLine);

  /** 단계 표시를 계획대로 다시 씀 (샘플 수가 정해지면 문구와 비중이 바뀜) */
  function applyPlan() {
    plan = stagePlan(mode, sampleTotal);
    plan.forEach(function (s) {
      const step = els.steps[s.id];
      if (!step) return;
      const st = step.querySelector('.sq-ld__st');
      const cnt = step.querySelector('.sq-ld__cnt');
      if (st) {
        if (st.firstChild && st.firstChild.nodeType === 3) st.firstChild.nodeValue = s.label + ' ';
        else st.insertBefore(document.createTextNode(s.label + ' '), st.firstChild);
      }
      if (cnt) cnt.textContent = (s.id === 'content' && mode === 'open' && sampleTotal > 0) ? sampleCountText(sampleDone, sampleTotal) : '';
    });
  }
  applyPlan();

  /** 한 프레임 — 목표 진행률로 그려진 값을 옮기고 화면을 고침 */
  function tick(ts) {
    raf = 0;
    if (!active) return;
    if (!startTs) { startTs = ts; lastTs = ts; }
    const dt = ts - lastTs;
    lastTs = ts;
    const target = overallProgress(plan.map(function (s) { return { weight: s.weight, fraction: fraction[s.id] }; }));
    displayed = reduced ? target : easeDisplayed(displayed, target, ts - startTs, minMs, dt);
    paint();
    if (finishing && displayed >= 1) { signalIn(); return; }
    raf = window.requestAnimationFrame(tick);
  }

  /** 그려진 값을 화면에 반영 — 파형, 퍼센트, 켜진 단계 */
  function paint() {
    if (els.wave) els.wave.style.strokeDashoffset = String(100 - displayed * 100);
    const pct = Math.floor(displayed * 100 + 1e-6);
    if (els.pct) els.pct.textContent = pct + '%';
    root.setAttribute('aria-valuenow', String(pct));
    // 단계는 "그 단계가 끝났고, 파형이 거기까지 그려졌을 때" 켬 (파형보다 앞서 켜지지 않게)
    let acc = 0;
    let total = 0;
    plan.forEach(function (s) { total += s.weight; });
    plan.forEach(function (s) {
      acc += s.weight;
      const step = els.steps[s.id];
      if (step) step.classList.toggle('is-done', fraction[s.id] >= 1 && displayed + 1e-6 >= acc / total);
    });
  }

  /** 100% — SIGNAL IN 을 켜고, 잠깐 뒤 열기 */
  function signalIn() {
    if (opened) return;
    opened = true;
    if (failed) {
      root.classList.add('is-failed');   // NO SIGNAL 을 그대로 두고 연다
    } else {
      root.classList.add('is-in');
    }
    window.setTimeout(open, failed ? 0 : (reduced ? 0 : SIGNAL_HOLD_MS));
  }

  /** 위아래로 열고 치움 */
  function open() {
    root.classList.add('is-opening');
    window.setTimeout(remove, reduced ? 160 : OPEN_MS);
  }

  function remove() {
    if (!active) return;
    active = false;
    window.clearTimeout(hardTimer);
    window.removeEventListener('resize', drawLine);
    if (raf) window.cancelAnimationFrame(raf);
    inerted.forEach(function (el) { try { el.inert = false; } catch (e) { /* 무시 */ } });
    root.remove();
    resolveFinish();
  }

  startFrames();
  hardTimer = window.setTimeout(function () {
    // 25초가 지나도 안 끝나면 그대로 엶 (끝나지 않은 단계는 켜지 않은 채)
    finishing = true;
    displayed = 1;
    paint();
    signalIn();
  }, HARD_TIMEOUT_MS);

  function startFrames() { raf = window.requestAnimationFrame(tick); }

  return {
    setProject: function (info) {
      if (els.name && info && info.title != null) els.name.textContent = String(info.title);
      if (els.info && info && info.info != null) els.info.textContent = String(info.info);
    },
    setStage: function (id, f) {
      if (fraction[id] === undefined) return;
      fraction[id] = Math.max(fraction[id], Math.max(0, Math.min(1, Number(f) || 0)));   // 줄어들지 않음
    },
    setSampleTotal: function (total) {
      sampleTotal = Math.max(0, Number(total) || 0);
      sampleDone = 0;
      applyPlan();
      if (sampleTotal === 0) fraction.content = 1;
    },
    setSamples: function (done, total) {
      sampleTotal = Math.max(0, Number(total) || 0);
      sampleDone = Math.max(0, Math.min(sampleTotal, Number(done) || 0));
      applyPlan();
      fraction.content = sampleTotal > 0 ? sampleDone / sampleTotal : 1;
    },
    fail: function () { failed = true; },
    /** 모든 단계를 끝으로 보고, 그려진 값이 100% 에 닿으면 열림. 열려서 치워지면 풀리는 Promise */
    finish: function () {
      if (!finishing) {
        finishing = true;
        fraction.data = fraction.content = fraction.engine = 1;   // 불러오기가 끝났으므로 모든 단계를 끝으로 봄
        if (failed) displayed = 1;                               // 실패했으면 기다리지 않고 바로 엶
      }
      return finished;
    },
    isActive: function () { return active; },
  };
}
