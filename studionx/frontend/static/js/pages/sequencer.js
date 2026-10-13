// 시퀀서 화면 (studioNx.html) — 템플릿 (구현은 직접, PRD 02 §4.17~4.19)
// 화면 구조·클래스 설명: docs/ai-notes/29_sequencer_screen.md
// 상태 클래스는 <body class="sq"> 에 붙임: .is-playing · .is-recording · .is-automation
// 소리(Web Audio)·타이밍(PPQ 960)·저장(API)은 다른 모듈에서 — 여기서는 화면 연결만
// 편곡 드래그(좌우 이동 · 클립 옮기기 · 목록에서 끌어 놓기)는 AI 구현 sequencer-arrange.js (사용자 요청 2026-10-06)
// 피아노롤(확대·격자·노트 찍기, MIDI 클립 더블 클릭으로 열기)은 AI 구현 sequencer-roll.js (사용자 요청 2026-10-06)
// 오토메이션 모드 · 점 찍기 · ↕ 곡선은 AI 구현 sequencer-automation.js (사용자 요청 2026-10-06) — setAutomationMode 템플릿 대신
// 나머지 화면 버튼(메뉴 · 언어 · 왼쪽 버튼 줄 · 아래 칸 · 트랙 펼침 …)은 AI 구현 sequencer-ui.js (사용자 요청 2026-10-06) — 아래 템플릿 함수 중 화면 부분을 대신

import { initArrange } from './sequencer-arrange.js';
import { initRoll } from './sequencer-roll.js';
import { initAutomation } from './sequencer-automation.js';
import { initUI } from './sequencer-ui.js';

/** 1박 = 960 tick (DB.md 와 같음) */
export const PPQ = 960;

/**
 * 시작
 * - projectId = new URLSearchParams(location.search).get('projectId') — 없으면 myProject.html 로
 * - requireLogin() (core/auth.js) 후 loadProject(projectId)
 * - initMenus() · initRail() · initTracks() · initBottom() · initShortcuts() · initDropZone() · initLanguage()
 */
export async function init() {
  // TODO
}

/**
 * 프로젝트 전체 불러와 그리기
 * - GET /api/v1/projects/{id}/full → { project, tracks, clips, patterns, markers, tempo_changes, meter_changes }
 * - 예시로 들어 있는 #tracks 의 li.sq-track 들을 지우고 renderTrack() 로 다시 채움
 * - 상단 BPM(#bpm) · 박자 · Key(#key) · 마커 줄 · 루프 구간도 채움
 * - 실패하면 (2026-10-06 결정) 404 → location.replace('errors/404.html'), 403 → errors/403.html, 500 이상 → errors/500.html
 *   401 은 api.js 재발급 실패 → requireLogin() 흐름
 * @param {number|string} projectId
 */
export async function loadProject(projectId) {
  // TODO
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

/**
 * 클립 미리보기 그리기 (canvas.sq-clip__preview)
 * - MIDI: 노트를 실제 음높이·길이대로 작은 막대로 (FR-2196)
 * - 오디오: 파형 (samples 의 peaks 데이터)
 * - 그리면 CSS 자리 무늬는 canvas 위에 덮여 안 보임
 * @param {HTMLCanvasElement} canvas
 * @param {object} clip
 */
export function drawClipPreview(canvas, clip) {
  // TODO
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
 * 명령 실행 — 메뉴 data-command · 단축키 · 커맨드 팔레트가 모두 이것을 부름
 * - 'edit.undo', 'track.addReturn', 'view.automation' … (studioNx.html 의 data-command 목록)
 * - 예: COMMANDS = { 'view.mixer': () => openBottom('mixer'), 'view.automation': () => setAutomationMode(!on), … }
 * @param {string} command
 */
export function runCommand(command) {
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
 * 단축키 (FR-2249)
 * - Space 재생/멈춤, Tab 믹서, A 오토메이션 모드, P/B/D/T/S/C/E 도구, V 펼침, Esc 닫기
 * - 입력칸(input·select·textarea)에 커서가 있으면 무시
 */
export function initShortcuts() {
  // TODO
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

// 편곡 드래그 — 저장은 init() 구현 때 onChange 로 연결 (예: change.type === 'move' → PATCH /clips/{id})
initArrange({ onChange: (change) => console.debug('[arrange]', change.type, change.trackId, change.start, change.length) });

// 피아노롤 — 노트 저장은 init() 구현 때 onChange 로 연결 (예: PUT /patterns/{id}/notes)
initRoll({ onChange: (change) => console.debug('[roll]', change.type, change.pitch, change.start, change.length) });

// 오토메이션 — 점 저장은 init() 구현 때 onChange 로 연결 (예: PUT /automation-lanes/{id}/points)
initAutomation({ onChange: (change) => console.debug('[automation]', change.type, change.on ?? JSON.stringify(change.points)) });

// 화면 버튼 — 저장은 init() 구현 때 onChange 로 연결
initUI({ onChange: (change) => console.debug('[ui]', change.type) });
