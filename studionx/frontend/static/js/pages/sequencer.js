// 시퀀서 화면 (studioNx.html) — 템플릿 (구현은 직접, PRD 02 §4.17~4.19)
// 화면 구조·클래스 설명: docs/ai-notes/29_sequencer_screen.md
// 상태 클래스는 <body class="sq"> 에 붙임: .is-playing · .is-recording · .is-automation
// 소리(Web Audio)·타이밍(PPQ 960)·저장(API)은 다른 모듈에서 — 여기서는 화면 연결만
// 편곡 드래그(좌우 이동 · 클립 옮기기 · 목록에서 끌어 놓기)는 AI 구현 sequencer-arrange.js (사용자 요청 2026-10-06)
// 피아노롤(확대·격자·노트 찍기, MIDI 클립 더블 클릭으로 열기)은 AI 구현 sequencer-roll.js (사용자 요청 2026-10-06)
// 오토메이션 모드 · 점 찍기 · ↕ 곡선은 AI 구현 sequencer-automation.js (사용자 요청 2026-10-06) — setAutomationMode 템플릿 대신
// 나머지 화면 버튼(메뉴 · 언어 · 왼쪽 버튼 줄 · 아래 칸 · 트랙 펼침 …)은 AI 구현 sequencer-ui.js (사용자 요청 2026-10-06) — 아래 템플릿 함수 중 화면 부분을 대신

import { initArrange, TICKS_PER_BAR, restoreOpenPanels, showToast } from './sequencer-arrange.js';
import { initRoll } from './sequencer-roll.js';
import { initAutomation } from './sequencer-automation.js';
import { initUI } from './sequencer-ui.js';
import {
  initDevices, readProjectId, applyFullProject, setDeviceNotifier,
  trackById, reapplyDevice, dropDevice, restoreDevice, moveEffectSlots,
} from './sequencer-devices.js';
import { api, ApiError } from '../core/api.js';
import { requireLogin } from '../core/auth.js';
import { initPalette, runCommand as runRegistered } from './sequencer-commands.js';
import { initHistory, pushHistory, undo, redo, clearHistory } from './sequencer-history.js';
import { initSave, setProjectId, queueSettings, markDirty } from './sequencer-save.js';

/** 1박 = 960 tick (DB.md 와 같음) */
export const PPQ = 960;

/**
 * 시작 (272)
 * - projectId = readProjectId() — 없으면 예시 화면 그대로 (S1-09 결정, 데모 모드)
 * - 로그인 확인(requireLogin) → loadProject(projectId) 로 서버 값 채우기
 * - 명령 레지스트리 · 되돌리기 · 저장 · 단축키를 먼저 세워 두고, 화면 모듈의 onChange 를 한 곳(handleChange)으로 모음
 */
export async function init() {
  initHistory({ toast: showToast });
  initSave({ toast: showToast });
  initPalette({ toast: showToast });
  initShortcuts();
  setDeviceNotifier(handleChange);

  const projectId = readProjectId();
  if (!projectId) return;                    // 예시 화면: 숫자·트랙을 그대로 두고 저장도 하지 않습니다
  setProjectId(projectId);
  if (!(await requireLogin())) return;        // 로그인 안 됐으면 home.html 로 보냄
  try {
    await loadProject(projectId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return;   // api.js 재발급 실패 → requireLogin 흐름
    showToast('Could not open this project — showing the example screen');
    if (window.console) console.warn('[sequencer]', err);
  }
}

/**
 * 프로젝트 전체 불러와 그리기 (272 · FR-254)
 * - GET /api/v1/projects/{id}/full 한 번으로 프로젝트 · 트랙(+악기·이펙트·연결선) · 패턴(+노트)을 받습니다
 * - 상단 BPM(#bpm) · Key(#key) · 박자, 트랙 줄과 펼침 칸은 applyFullProject 가 맡습니다
 * - 실패: 404 → errors/404.html, 403 → errors/403.html, 그 밖(500 등) → errors/500.html
 * @param {number|string} projectId
 * @returns {Promise<object>} 서버 응답
 */
export async function loadProject(projectId) {
  let data;
  try {
    data = await api.get('/projects/' + encodeURIComponent(projectId) + '/full');
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) { location.replace('errors/404.html'); return null; }
      if (err.status === 403) { location.replace('errors/403.html'); return null; }
      if (err.status >= 500) { location.replace('errors/500.html'); return null; }
    }
    throw err;
  }
  setProjectId(projectId);
  clearHistory();
  applyProjectInfo(data.project);
  applyPatterns(data.patterns);
  applyFullProject(data);
  if (window.console) console.debug('[sequencer] loaded', projectId, data.tracks.length, 'tracks');
  return data;
}

/* ───────── 서버 값 → 화면 (272) ───────── */

/** 서버가 준 패턴 — 노트까지 담고 있습니다 (피아노롤·클립 미리보기가 나중에 씁니다) */
const patternsById = {};

/**
 * 프로젝트 칸을 상단에 채우기 (272) — BPM · Key · 박자 · 마스터
 * @param {object} project
 */
function applyProjectInfo(project) {
  if (!project) return;
  applyBpm(project.bpm);
  applyKey(project.music_key);
  setText('#pattern-select', null);                       // 패턴은 applyPatterns 가 채웁니다
  setText('.sq-global--meter .sq-global__head small', project.time_sig_num + '/' + project.time_sig_den);
  document.body.dataset.sampleRate = String(project.sample_rate || '');
  document.body.dataset.revision = String(project.revision || '');
}

/** BPM 을 화면·상태에 넣기 (272) — 칩 · 몸통 --bpm · Nyxi 말풍선 */
function applyBpm(value) {
  const bpm = Number(value);
  if (!Number.isFinite(bpm) || bpm <= 0) return;
  const chip = document.getElementById('bpm');
  if (chip) chip.textContent = bpm.toFixed(3);
  document.body.style.setProperty('--bpm', bpm);
  Array.prototype.forEach.call(document.querySelectorAll('.sq-nyxi span'), function (span) {
    span.textContent = '♪ ' + Math.round(bpm) + ' BPM';
  });
  setText('.sq-global--tempo .sq-global__head small', Math.round(bpm) + ' BPM');
}

/** Key 를 화면에 넣기 (272) — Key 칩과 피아노롤 속성 */
function applyKey(value) {
  if (!value) return;
  setText('#key', 'Key: ' + value + ' ▾');
  const dd = Array.prototype.filter.call(
    document.querySelectorAll('.sq-roll__props div'),
    function (div) { return div.querySelector('dt') && div.querySelector('dt').textContent === 'Scale'; },
  )[0];
  const scale = dd ? dd.querySelector('dd') : null;
  if (scale) scale.textContent = value;
}

/**
 * 패턴 목록을 왼쪽 PATTERNS 목록에 채우기 (272 · FR-254)
 * @param {object[]} patterns
 */
function applyPatterns(patterns) {
  const list = document.getElementById('pattern-list');
  const items = patterns || [];
  items.forEach(function (pattern) { patternsById[pattern.pattern_id] = pattern; });
  if (!list) return;
  const bars = function (pattern) {
    const value = Math.round((pattern.length_tick || 0) / TICKS_PER_BAR * 100) / 100;
    return value > 0 ? value : 1;
  };
  list.innerHTML = items.map(function (pattern, i) {
    return '<li class="sq-file sq-pattern" role="option" aria-selected="false" draggable="true"'
      + ' data-kind="midi" data-name="' + escapeAttr(pattern.name) + '"'
      + ' data-bars="' + bars(pattern) + '" data-color="' + (((i) % 5) + 1) + '"'
      + ' data-pattern-id="' + pattern.pattern_id + '">'
      + '<span>▤</span><span class="sq-file__name">' + escapeAttr(pattern.name) + '</span>'
      + '<span class="sq-file__meta sq-num">' + bars(pattern) + ' bar</span></li>';
  }).join('');
  const first = items[0];
  if (first) setText('#pattern-select', 'Pattern: ' + first.name + ' ▾');
  if (window.console) console.debug('[sequencer] patterns', items.length);
}

/** 서버가 준 패턴 하나 (272) — 피아노롤·미리보기가 노트를 꺼내 씁니다 */
export function patternById(id) {
  return patternsById[id] || null;
}

/* ───────── 화면 모듈의 onChange → 이력 · 저장 (272 · FR-2169 · FR-255) ───────── */

/** 상단 값의 지금 상태 — 되돌리기(undo)가 이전 값으로 되돌립니다 */
const song = { bpm: null, music_key: null };

/**
 * 화면 모듈이 보낸 변화 한 건 처리하기 (272)
 * - 값이 바뀌면 이력 한 단계를 쌓고, 곡 설정이면 저장 대기열에 담습니다
 * - 되돌리기·다시 하기를 실행하는 중이면 history 쪽에서 무시됩니다
 * @param {{ type: string }} change
 */
export function handleChange(change) {
  if (!change || !change.type) return;
  switch (change.type) {
    case 'bpm': {
      const before = song.bpm;
      song.bpm = Number(change.bpm);
      pushHistory({ label: 'BPM ' + song.bpm, undo: () => applyBpmChange(before), redo: () => applyBpmChange(song.bpm) });
      queueSettings({ bpm: change.bpm });
      break;
    }
    case 'key': {
      const before = song.music_key;
      song.music_key = change.key;
      pushHistory({ label: 'Key ' + change.key, undo: () => applyKeyChange(before), redo: () => applyKeyChange(change.key) });
      queueSettings({ music_key: change.key });
      break;
    }
    case 'deviceAdd':
      pushHistory({
        label: change.label || 'Add device',
        undo: () => dropDevice(change.trackId, change.kind, change.deviceId),
        redo: () => restoreDevice(change.trackId, change.kind, change.snapshot),
      });
      markDirty('device');
      break;
    case 'deviceRemove':
      pushHistory({
        label: change.label || 'Remove device',
        undo: () => restoreDevice(change.trackId, change.kind, change.snapshot),
        redo: () => dropDevice(change.trackId, change.kind, change.deviceId),
      });
      markDirty('device');
      break;
    case 'deviceUpdate':
      pushHistory({
        label: change.label || 'Change device',
        undo: () => reapplyDevice(change.trackId, change.kind, change.deviceId, change.before, { silent: true }),
        redo: () => reapplyDevice(change.trackId, change.kind, change.deviceId, change.after, { silent: true }),
      });
      markDirty('device');
      break;
    case 'deviceMove':
      pushHistory({
        label: change.label || 'Change effect order',
        undo: () => moveEffectSlots(change.trackId, change.to, change.from),
        redo: () => moveEffectSlots(change.trackId, change.from, change.to),
      });
      markDirty('device');
      break;
    case 'trackState':
      markDirty('track');
      break;
    default:
      break;
  }
}

/** BPM 되돌리기·다시 하기 (272) — 화면도 값도 함께 되돌립니다 */
function applyBpmChange(value) {
  if (value === null || value === undefined) return;
  song.bpm = Number(value);
  applyBpm(song.bpm);
  queueSettings({ bpm: song.bpm });
}

/** Key 되돌리기·다시 하기 (272) */
function applyKeyChange(value) {
  if (!value) return;
  song.music_key = value;
  applyKey(value);
  queueSettings({ music_key: value });
}

/** 화면 글자 하나 바꾸기 (272) */
function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el && text !== null && text !== undefined) el.textContent = text;
}

/** 패턴 이름처럼 화면에 넣을 글자 다듬기 (272) */
function escapeAttr(text) {
  return String(text).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

/**
 * 명령 실행 (272 · FR-2169) — 메뉴 · 단축키 · 커맨드 팔레트 · Nyxi 액션이 모두 이 함수를 부릅니다
 * 실제 처리는 sequencer-commands.js 의 레지스트리가 맡습니다.
 * @param {string} command
 * @returns {boolean} 처리했으면 true
 */
export function runCommand(command) {
  return runRegistered(command);
}

/**
 * 트랙 한 줄 만들기 (HTML 모양은 studioNx.html 의 li.sq-track 과 같게)
 * - data-track-id, data-color(1~5 | audio)
 * - 클립: style="--s:시작마디; --l:길이마디" — tick 을 마디로: tick / (PPQ * 박자 분자)
 * - MASTER 는 이 목록에 넣지 않음 (늘 맨 아래 고정, FR-252)
 * @param {object} track
 * @param {object[]} clips
 * @returns {HTMLLIElement}
 */
export function renderTrack(track, clips) {
  // TODO
}

/** MIDI 클립 → 미리보기 노트 목록 (피아노롤에서 바뀔 때마다 채운다) */
const clipNotes = new WeakMap();

/**
 * MIDI 클립의 미리보기 노트를 담고 다시 그린다 (요구사항 1, 2026-10-17)
 * @param {HTMLElement} clip
 * @param {{pitch:number,start_tick:number,length_tick:number}[]} notes
 */
export function setClipNotes(clip, notes) {
  clipNotes.set(clip, notes || []);
  drawClipPreview(clip.querySelector('.sq-clip__preview'), clip);
}

/**
 * 클립 미리보기 그리기 (canvas.sq-clip__preview)
 * - MIDI: 노트를 실제 음높이·길이대로 작은 막대로 (FR-2196)
 * - 오디오: 파형 (samples 의 peaks 데이터) — 편곡의 drawWaveforms 가 그리므로 여기서는 건너뜀
 * - 그리면 CSS 자리 무늬는 canvas 위에 덮여 안 보임
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} clip
 */
export function drawClipPreview(canvas, clip) {
  if (!canvas || !clip || !clip.classList.contains('sq-clip--midi')) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pw, ph);
  const notes = clipNotes.get(clip) || [];
  if (w < 2 || h < 2 || !notes.length) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bars = parseFloat(clip.style.getPropertyValue('--l')) || 1; // 클립 길이(마디)
  const ticks = bars * TICKS_PER_BAR;
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) { if (n.pitch < lo) lo = n.pitch; if (n.pitch > hi) hi = n.pitch; }
  if (hi === lo) { lo -= 1; hi += 1; }
  const pad = 0.12;
  const barH = Math.max(1, Math.round(h * 0.14));
  ctx.fillStyle = getComputedStyle(clip).getPropertyValue('--tc').trim() || 'currentColor';
  for (const n of notes) {
    const x = (n.start_tick / ticks) * w;
    const bw = Math.max(1, (n.length_tick / ticks) * w);
    const y = (1 - (n.pitch - lo) / (hi - lo)) * (1 - pad * 2) + pad;
    ctx.fillRect(x, y * h - barH / 2, Math.min(bw, w - x), barH);
  }
}

/**
 * 트랙 펼침 (V) — FR-262
 * - 눌린 트랙 바로 밑에 li.sq-acc 를 열고 aria-expanded="true", 트랙에 .is-open
 * - 기본은 하나만 (다른 펼침은 닫음), event.shiftKey 면 여러 개
 * @param {HTMLElement} track  li.sq-track
 * @param {boolean} keepOthers
 */
export function toggleTrackPanel(track, keepOthers = false) {
  // TODO
}

/**
 * 아래 칸 열기 (FR-2200) — 패널 하나만 보임
 * - 'roll'(MIDI 클립 클릭) · 'sample'(오디오 클립) · 'agent'(Nyxi 더블 클릭) · 'mixer'(Tab · 왼쪽 Mixer 버튼)
 * - 같은 패널을 다시 열면 닫힘, Esc 로 닫힘
 * - #bottom.hidden = false, 해당 .sq-panel 만 hidden = false
 * @param {'roll'|'sample'|'agent'|'mixer'|null} name  null 이면 닫기
 */
export function openBottom(name) {
  // TODO
}

/**
 * 상단 메뉴 (FILE~HELP, FR-2241~2248) · 언어 메뉴 드롭다운
 * - .sq-menu__item 클릭 → aria-controls 의 #menu-{name} 열기 (aria-expanded), 바깥 클릭·Esc 로 닫기
 * - 드롭다운 위치는 눌린 버튼 아래로 (button.offsetLeft) — HTML 의 left 값은 대략값
 * - 메뉴가 열린 상태에서 옆 메뉴에 마우스를 올리면 그 메뉴로 바뀜, ←/→ 로 옆 메뉴, ↑/↓ 로 항목 이동
 * - 항목 클릭 → runCommand(button.dataset.command) — 단축키·커맨드 팔레트·오른쪽 클릭 메뉴와 같은 명령 (FR-2169)
 */
export function initMenus() {
  // TODO
}

/**
 * 왼쪽 버튼 줄 (FR-2193)
 * - 카테고리 버튼(data-category) → 파일 패널 제목·목록 바꾸기 (GET /api/v1/library?category=…)
 * - #rail-mixer → openBottom('mixer'), #rail-members · #rail-chat → #collab 열고 닫기
 */
export function initRail() {
  // TODO
}

/**
 * 트랙 영역 이벤트 (위임 하나로)
 * - .sq-power / .sq-msr 버튼 → aria-pressed 바꾸고 PATCH /tracks/{id}
 * - .sq-expand → toggleTrackPanel
 * - .sq-clip 클릭 → 선택(.is-selected), 더블 클릭 → MIDI 면 openBottom('roll'), 오디오면 'sample'
 * - #add-track → 새 트랙 (MIDI/Audio 선택)
 */
export function initTracks() {
  // TODO
}

/**
 * 샘플 설정 패널 (#panel-sample, FR-2213·2214)
 * - 오디오 클립을 누르면 그 클립 값으로 채움: 제목, #sample-form 값, 마커·페이드 위치(--at, --len = %)
 * - 파형은 .sq-wave__canvas 에 그림 (samples 의 peaks)
 * - 시작·끝·Warp 마커(.sq-wave__mark)는 좌우로 끌어 옮김 → PATCH /clips/{id}
 * - 옵션 버튼(.sq-toggles)은 aria-pressed 바꿈, AI stem separation → PRD 04 작업 요청
 * @param {object} clip
 */
export function openSamplePanel(clip) {
  // TODO
}

/**
 * Nyxi Agent 패널 (#panel-agent, PRD 05)
 * - 제안 카드(.sq-card): Apply → 설정 적용, Preview → 잠깐 들어 보기, Dismiss → 카드 지움
 * - #agent-form 제출 → #agent-log 에 내 말풍선(.is-user) 추가 후 Nyxi 응답(.is-nyxi)
 */
export function initAgent() {
  // TODO
}

/**
 * 오토메이션 모드 켜고 끄기 (A 키 · #automation-mode, FR-224)
 * - body.classList.toggle('is-automation', on) → CSS 가 패턴 흐림 · .sq-auto · 템포/박자 줄(.sq-global) 표시
 * - #automation-mode aria-pressed, 힌트 바(#hint) 문구 바꾸기
 * @param {boolean} on
 */
export function setAutomationMode(on) {
  // TODO
}

/**
 * 오토메이션 클립 끌기 (목업 03)
 * - 끄는 동안 .sq-auto.is-ghost 를 보여 주고, 다음 패턴 시작 위치에 .sq-auto-limit(--at) 표시
 * - 패턴 끝을 넘어 빈 마디까지는 되지만 다음 패턴 시작을 넘지 못함 (오른쪽 끝을 거기서 멈춤)
 * - 놓으면 POST /automation-clips (대상 = 놓은 곳의 패턴 · 파라미터)
 * @param {PointerEvent} event
 */
export function dragAutomation(event) {
  // TODO
}

/**
 * 패턴을 오토메이션 아래에 놓았을 때 묻는 창 (#auto-overlap, 목업 09)
 * - 문구·작은 그림(.sq-mini 의 --s · --l = %) 을 채우고 showModal()
 * - 'Always do this' 가 체크되어 있으면 다음부터는 묻지 않고 그 선택으로 (프로젝트 설정)
 * @param {{ pattern: object, automation: object, bar: number }} info
 * @returns {Promise<'trim'|'split'|'undo'|null>}  close 의 returnValue 와 라디오 값
 */
export function askAutomationOverlap(info) {
  // TODO
}

/**
 * 템포 · 박자 줄 (FR-202a, 목업 14)
 * - tempo_changes → .sq-global__pt(--at 마디, --y = (170 - bpm) / 40 * 100) + polyline points
 * - meter_changes → .sq-global__seg(--s · --l), 바뀌는 곳은 .is-change
 * - 점을 끌어 BPM·위치 바꾸기, 더블 클릭으로 추가
 * @param {object[]} tempoChanges
 * @param {object[]} meterChanges
 */
export function renderGlobalLanes(tempoChanges, meterChanges) {
  // TODO
}

/**
 * 그룹(폴더) 트랙 접기·펴기 (FR-2211)
 * - .sq-fold 의 aria-expanded 바꾸고, data-parent 가 그 그룹인 트랙(.is-child)과 그 펼침을 hidden
 * - 그룹 레인의 .sq-gbar 는 안쪽 트랙 클립 위치(--s · --l)를 모아 그림
 * - 트랙을 그룹 위로 끌어 놓으면 PATCH /tracks/{id} { parent_track_id }
 * @param {HTMLElement} groupTrack  li.sq-track--group
 */
export function toggleGroup(groupTrack) {
  // TODO
}

/**
 * 트랙 추가 (#add-track 의 MIDI · Audio · Return, FR-2212)
 * - Return 이면 .sq-track--return 으로 ＋Add Track 아래 · MASTER 위에 넣음 (POST /tracks { type: 'RETURN' })
 * - 그 밖에는 #tracks 끝에
 * @param {'MIDI'|'AUDIO'|'RETURN'} type
 */
export async function addTrack(type) {
  // TODO
}

/**
 * 악기 스택 (FR-2198 · 목업 10·12) — 펼침의 .sq-istack
 * - '＋ Add instrument' → 악기 고르기 → .sq-irow 추가 (POST /tracks/{id}/instruments)
 * - 줄마다 켜기/끄기 · 볼륨 · 팬 · 솔로
 * - 다른 트랙이 Connect to Another 로 'Instruments (layer)' 에 보내면 .sq-irow.is-from 줄로 보임 (지울 수 없고, 그 트랙에서 끊음)
 * @param {HTMLElement} accordion  li.sq-acc
 * @param {object[]} instruments   track_instruments
 */
export function renderInstrumentStack(accordion, instruments) {
  // TODO
}

/**
 * Connect to Another 바꾸기 (FR-2197 · 목업 11)
 * - None → 트랙 번호·플러그인 칸 끄기, .sq-off 지우기
 * - Connected → 대상 트랙 번호 + 플러그인('Instruments (layer)' 이면 레이어) 고르기,
 *   믹서 칸에 .sq-off 덮개, 효과 칸 끝에 .sq-sendto, 트랙 이름 줄에 .sq-link('→1'), 대상 트랙에는 '⇠10'
 * - PUT /tracks/{id}/connection (track_connections)
 * @param {HTMLElement} accordion
 */
export function updateConnection(accordion) {
  // TODO
}

/** 아래 칸 닫기 버튼 · Nyxi 더블 클릭 */
export function initBottom() {
  // TODO
}

/**
 * 단축키 (272 · FR-2249 · FR-253 · FR-255)
 * - Ctrl+S 저장, Ctrl+Z 되돌리기, Ctrl+Shift+Z · Ctrl+Y 다시 하기, Ctrl+P 커맨드 팔레트
 * - Space 재생 · Tab 믹서 · A 오토메이션 · P/B/D/T/S/C/E 도구 · V 펼침 · Esc 닫기는
 *   각 모듈(sequencer-ui.js · sequencer-arrange.js)이 이미 받고 있습니다
 * - 입력칸(input·select·textarea)에 커서가 있거나 창(dialog)이 떠 있으면 무시
 */
export function initShortcuts() {
  document.addEventListener('keydown', function (event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.target.closest && event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    if (key === 's' && !event.shiftKey) {
      event.preventDefault();
      runRegistered('project.save');
    } else if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      redo();
    }
  });
}

/**
 * 파일 끌어 놓기 (#drop-zone, FR-2194)
 * - dragover 에 .is-over, drop → 업로드 (POST /api/v1/samples, multipart)
 * - #upload-button → #upload-input.click()
 */
export function initDropZone() {
  // TODO
}

/**
 * 시퀀서 언어 EN / KO / JA (FR-2171, 기본 EN)
 * - 사전: static/i18n/sequencer.json (fetch 한 번) — text(글자 전체가 같을 때) · prefix(앞부분 정규식, $1) · templates(JS 가 값을 넣는 문장)
 * - document.body 의 글자 노드를 돌면서 skip 선택자 안(트랙·파일 이름, 채팅, 플러그인 이름 등)은 건너뛰고 바꿈
 *   placeholder 도 같은 방법으로, #lang-button 글자는 labels[lang], <html lang> 도 바꿈
 * - en 으로 돌아갈 때는 처음 영어 글자를 기억해 두었다가 되돌림 (예: WeakMap 노드 → 원래 글자)
 * - 고른 언어는 사용자 설정에 저장 (PATCH /api/v1/me/settings)
 * @param {'en'|'ko'|'ja'} lang
 */
export function setLanguage(lang) {
  // TODO
}

/** #lang-button 메뉴 연결 */
export function initLanguage() {
  // TODO
}

/**
 * 재생 상태에 맞춰 화면 바꾸기
 * - body.is-playing (Nyxi 춤, --bpm 으로 속도) · #time-main / #time-bars · .sq-playhead 의 --at
 * - #time 클릭 → 큰 글씨 분:초:밀리초 ↔ 마디.박.틱 바꾸기
 * @param {{ playing: boolean, recording: boolean, tick: number, bpm: number }} state
 */
export function updateTransport(state) {
  // TODO
}

init();

// 편곡 드래그 — 이력·저장은 S1-10 의 handleChange 가 맡습니다 (클립 저장은 클립 표가 생긴 뒤)
initArrange({ onChange: (change) => handleChange(change) });

// 피아노롤 — 노트 변화 알림 (이력·저장 연결은 패턴 저장 작업에서)
initRoll({ onChange: (change) => handleChange(Object.assign({}, change, { type: 'note' })) });

// 오토메이션 — 점 저장은 오토메이션 표가 생긴 뒤 (S2-04)
initAutomation({ onChange: (change) => handleChange(Object.assign({}, change, { type: 'automation' })) });

// 화면 버튼 — 곡 설정(BPM · Key)은 이력·저장 대기열로, 나머지는 표시만
initUI({ onChange: (change) => handleChange(change) });

/**
 * 피아노롤 노트 변화 → 그 MIDI 클립 미리보기 다시 그리기 (요구사항 1, 2026-10-17)
 * - sequencer-roll.js 가 노트를 바꿀 때마다 'sq:roll-notes' 를 보낸다
 */
function initClipPreviews() {
  document.addEventListener('sq:roll-notes', (e) => {
    const detail = e.detail || {};
    if (detail.clip) setClipNotes(detail.clip, detail.notes || []);
  });
}
initClipPreviews();

// FR-261 — 지난번에 펼쳐 둔 트랙 아코디언 상태를 되살린다
restoreOpenPanels();

// 악기·이펙트 칸 (S1-09 화면) — ?projectId= 가 있으면 서버 값으로 그리고, 고친 값을 저장한다.
// initUI 뒤에 두어야 편곡 쪽 배선이 먼저 서 있는 상태에서 값을 읽는다 (2026-10-18)
initDevices({ onChange: (change) => handleChange(change) });

