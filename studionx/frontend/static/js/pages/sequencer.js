// 시퀀서 화면 (studioNx.html) — 템플릿 (구현은 직접, PRD 02 §4.17~4.19)
// 화면 구조·클래스 설명: docs/ai-notes/29_sequencer_screen.md
// 상태 클래스는 <body class="sq"> 에 붙임: .is-playing · .is-recording · .is-automation
// 소리(Web Audio)·타이밍(PPQ 960)·저장(API)은 다른 모듈에서 — 여기서는 화면 연결만

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
 * - .sq-menu__item 클릭 → 해당 #menu-{name} 열기 (aria-expanded), 바깥 클릭·Esc 로 닫기
 * - 메뉴가 열린 상태에서 옆 메뉴에 마우스를 올리면 그 메뉴로 바뀜
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
 * - [data-i18n] 의 글자만 바꿈 (트랙·파일 이름 같은 사용자 글자는 그대로)
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
