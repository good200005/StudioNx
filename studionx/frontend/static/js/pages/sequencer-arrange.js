import { PPQ } from '../audio/timing.js';

// 시퀀서 편곡 영역 드래그 · 재생선 (구현: AI — 사용자 요청 2026-10-06 "수정 사항.pdf", "수정 사항2.pdf")
// 설명: docs/ai-notes/30_sequencer_arrange_drag.md
// 1) 마디 줄 · 마커 줄 · 트랙의 빈 칸을 끌면 편곡이 왼쪽/오른쪽으로 움직임 (가운데 버튼은 어디서나)
// 2) 클립(패턴·샘플)을 끌어서 옮김 — 1박 단위로 붙고, 자기 트랙 안에서 좌우로만 (Ableton 방식, 수정 사항2)
// 3) 왼쪽 목록(Samples · Patterns)에서 트랙으로 끌어 놓으면 클립이 생김
// 4) 재생선 — 재생 방식 두 가지(재생선이 움직임 / 트랙이 움직임) 중 고르기 (수정 사항2)
// 5) 마커를 끌어 좌우로 옮김 · Ctrl+휠 확대·축소 (격자가 마디 → 박 → 1/16 로 촘촘해짐, 스냅도 보이는 격자선에)
// 6) Ctrl+클릭으로 클립 여러 개 선택 → 함께 옮김, Ctrl+A 모두 선택 · 셋잇단(Triplet) 격자
// 7) 도구 막대 도구 고르기 — Select(E) 일 때 빈 곳을 끌면 사각형 영역 선택 · 스냅 Line/Off + Alt 끌기는 격자 무시 ·
//    마커 줄에서 오른쪽 버튼으로 끌어 Loop 구간 (켜면 미리보기 재생이 구간 안에서 반복)
// 8) 트랙 높이 — 트랙 아래 경계를 끌면 그 트랙, Alt+끌기 · ↕−/↕+ 는 전체, 경계 더블 클릭은 기본 높이로
// 9) 선택한 클립을 Delete · Backspace(또는 EDIT › Delete)로 지우기 — 마지막으로 누른 곳이 편곡일 때
// 10) 목록에서 빈 곳(＋ Add Track 줄 · 그 아래)에 놓으면 새 트랙(샘플 = 오디오, 패턴 = MIDI) ·
//     종류가 다른 트랙에 놓으면 새 트랙을 만들지 물어보고 그 트랙 바로 아래에 — 트랙 번호는 위치대로 다시 매김
// 11) 도구 동작 (P Draw · B Paint · D Delete · T Mute · S Slip · C Slice · Zoom) + 단축키
// 12) 트랙 머리 버튼 (켜기/끄기 · M · S · ● · V · 그룹 ▾) · ＋ Add Track (MIDI · Audio · Return)
//    머리의 빈 곳 클릭 = 트랙 선택 (Ctrl = 여러 개 · Shift = 사이 모두) · Ctrl+G = 선택 트랙 그룹화 · 오른쪽 클릭 = 메뉴
// 13) 마커 (＋ · ◀ ▶ · 빈 곳 오른쪽 클릭 · 클릭 = 이동 · 더블 클릭 = 이름 · 선택 후 Delete) · 녹음 ● · 시간 표시
//    소리 엔진이 아직 없어서 ▶ 를 누르면 BPM 에 맞춰 화면의 재생선만 움직임. 엔진이 생기면 setPlayheadBar() 로 위치를 넘기면 됨
// 위치·길이는 화면에만 바뀜. 저장(PATCH /clips/{id}, POST /clips)은 sequencer.js 구현 때 onChange 에서

/** 클립 · 마커가 붙는 단위 (마디) — 기본값. 실제로는 확대 단계에 따라 바뀜 (getSnap, "Snap: Line") */
export const SNAP = 0.25;

/** 이만큼(px) 움직여야 클릭이 아니라 끌기로 봄 */
const DRAG_THRESHOLD = 4;

/** 클립 끝에서 이만큼(px) 안쪽을 잡으면 옮기기가 아니라 길이 조절로 봄 (FR-208) */
const EDGE_PX = 6;

/** 끄는 동안 편곡 영역 가장자리에서 자동으로 스크롤하는 폭(px)과 속도 */
const EDGE = 40;
const EDGE_SPEED = 14;

/** dataTransfer 에 담는 종류 이름 */
const DND_TYPE = 'application/x-studionx-clip';

/**
 * @param {object} [options]
 * @param {(change: { type: 'move'|'create'|'createTrack'|'renumber'|'delete'|'marker'|'loop'|'trackHeight', clip?: HTMLElement, marker?: HTMLElement, trackId?: string, start?: number, length?: number, on?: boolean, height?: number, all?: boolean }) => void} [options.onChange]
 *        클립을 옮기거나 만들었을 때 · 마커를 옮겼을 때 · Loop · 트랙 높이를 바꿨을 때 (저장은 여기서)
 */
export function initArrange({ onChange = () => {} } = {}) {
  const scroll = document.getElementById('arrange');
  const lanes = document.getElementById('lanes');
  if (!scroll || !lanes) return;
  const ctx = { scroll, lanes, onChange };
  initPan(ctx);
  initClipDrag(ctx);
  initListDrop(ctx);
  initBrowserLists();
  initPlayhead(ctx);
  initZoom(ctx);
  initWaveforms(ctx);
  initMarkerDrag(ctx);
  initTools();
  initMarquee(ctx);
  initSnapMenu();
  initLoop(ctx);
  initTrackHeight(ctx);
  initDeleteClips(ctx);
  initToolActions(ctx);
  initTrackReorder(ctx);
  initTrackButtons(ctx);
  initMarkers(ctx);
  initRecord(ctx);
}

/* ───────────── 공통 ───────────── */

/** 지금 1마디 폭(px) — CSS 가 화면 폭에 맞춰 바꾸므로 그때그때 잼 */
function barWidth(lanes) {
  const lane = lanes.querySelector('.sq-track__lane');
  const bars = parseFloat(getComputedStyle(lanes).getPropertyValue('--sq-bars')) || 999;
  return lane ? lane.getBoundingClientRect().width / bars : 28.8;
}

function totalBars(lanes) {
  return parseFloat(getComputedStyle(lanes).getPropertyValue('--sq-bars')) || 999;
}

/** 1틱 (마디) — 스냅을 끄면 이 단위로만 맞춤. PPQ 960 · 4/4 → 1마디 = 3840틱 */
export const TICK = 1 / (960 * 4);

/** 4/4 한 마디의 틱 수 — PPQ(960) × 4 = 3840. 박자표가 다른 곡(FR-202a)은 나중에 인자로 받습니다 */
export const TICKS_PER_BAR = PPQ * 4;

/**
 * tick 을 마디로 바꿉니다 (S1-06 타임라인 첫 함수, FR-209 좌표 기준).
 * - 엔진·DB 는 tick(1박 = 960) 단위이고, 편곡 화면은 마디 단위라서 이 변환이 필요합니다
 *   (예: S1-05 재생선 위치 `Transport.positionTick()` 을 마디로 바꿔 `setPlayheadBar()` 에 넘길 때)
 * - 템포(BPM)는 쓰지 않습니다. 여기서는 위치만 바꾸고, tick ↔ 초 변환은 `audio/timing.js` 가 맡습니다
 * - 나눗셈이라 소수가 나올 수 있습니다 (예: 480 tick = 0.125마디). 반올림은 부르는 쪽에서 합니다
 * - tick 이 숫자가 아니거나 NaN·Infinity 면 오류를 던집니다 (조용히 NaN 을 넘기면 재생선이 엉뚱한 곳에 섭니다)
 * @param {number} tick  위치 (tick)
 * @param {number} [ticksPerBar]  한 마디의 틱 수 (기본 4/4 = 3840)
 * @returns {number} 마디 (소수 가능)
 */
export function ticksToBars(tick, ticksPerBar = TICKS_PER_BAR) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  if (typeof ticksPerBar !== 'number' || !isFinite(ticksPerBar) || ticksPerBar <= 0) throw new RangeError('ticksPerBar 는 0 보다 큰 숫자여야 합니다: ' + ticksPerBar);
  return tick / ticksPerBar;
}

/**
 * 마디를 tick 으로 바꿉니다 (`ticksToBars` 의 역방향, S1-06 FR-208 클립 위치).
 * - 클립을 끌어 옮긴 마디를 저장·엔진용 tick 으로 돌려놓을 때 씁니다 (`clip.start_tick`, `clip.length_tick`)
 * - 곱셈이라 `ticksToBars(barsToTicks(b))` 는 다시 `b` 가 됩니다 (단, 부동소수 오차는 있을 수 있습니다)
 * - bar 가 숫자가 아니거나 NaN·Infinity 면 오류를 던집니다 (엉뚱한 tick 이 저장되는 것을 막습니다)
 * @param {number} bar  마디 (소수 가능)
 * @param {number} [ticksPerBar]  한 마디의 틱 수 (기본 4/4 = 3840)
 * @returns {number} tick (소수 가능)
 */
export function barsToTicks(bar, ticksPerBar = TICKS_PER_BAR) {
  if (typeof bar !== 'number' || !isFinite(bar)) throw new RangeError('bar 는 유한한 숫자여야 합니다: ' + bar);
  if (typeof ticksPerBar !== 'number' || !isFinite(ticksPerBar) || ticksPerBar <= 0) throw new RangeError('ticksPerBar 는 0 보다 큰 숫자여야 합니다: ' + ticksPerBar);
  return bar * ticksPerBar;
}

/** FR-206 스냅 칸 — 이름(1/n) → 분모 n. 화면 Snap 메뉴에 넣을 값들입니다 (박자표와 무관한 음표 길이) */
const DIVISION_DEN = { '1/1': 1, '1/2': 2, '1/4': 4, '1/8': 8, '1/16': 16, '1/32': 32 };

/**
 * 스냅 칸 이름을 tick 길이로 바꿉니다 (S1-06 FR-206 그리드 스냅의 첫 조각).
 * - 화면 Snap 메뉴에서 "1/4" 같은 칸을 고르면, 그 칸 하나가 몇 tick 인지 알려줍니다
 * - 음표 길이는 박자표와 무관합니다. 1/n 음표 = PPQ × 4 ÷ n  (1/4 음표 = 1박 = 960, 4/4·3/4 모두 같음)
 *   한 마디 tick 수는 박자표에 따라 달라지므로, 마디로 바꿀 때는 `ticksToBars()` 를 씁니다
 * - 셋잇단(1/n 을 3등분)은 다음 함수에서 다룹니다
 * - 이름이 목록에 없으면(오타·'1/3' 등) 오류를 던집니다
 * @param {string} division  '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'
 * @returns {number} 한 칸의 tick 수
 */
export function divisionTicks(division) {
  const den = DIVISION_DEN[division];
  if (typeof den !== 'number') throw new RangeError('알 수 없는 스냅 칸입니다: ' + division);
  return (PPQ * 4) / den;
}

/**
 * 셋잇단 칸의 tick 길이를 돌려줍니다 (S1-06 FR-206 셋잇단 포함).
 * - 2026-10-14 사용자 결정: 셋잇단 = 한 칸을 3등분 (원래 칸 ÷ 3). 그림 (나) 방식
 *   예: 1/4 칸(960) → 320, 1/8 칸(480) → 160, 1/16 칸(240) → 80
 * - 화면 ³ Triplet 을 켜면 스냅 단위가 `divisionTicks()` 대신 이 값이 됩니다
 * - 이름이 틀리면 `divisionTicks()` 가 오류를 던져 그대로 전해집니다
 * @param {string} division  '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'
 * @returns {number} 셋잇단 한 칸의 tick 수
 */
export function tripletTicks(division) {
  return divisionTicks(division) / 3;
}

/**
 * 스냅 한 칸의 tick 길이를 돌려줍니다 (S1-06 FR-206 — 칸 + 셋잇단을 한 값으로).
 * - Snap 메뉴에서 칸(예: '1/16')을 고르고 ³ Triplet 을 켰는지에 따라 한 칸 길이가 달라집니다
 *   (켜짐 = `tripletTicks()`, 꺼짐 = `divisionTicks()`)
 * - 끌기 코드는 이 값을 스냅 단위로 씁니다. 마디로 바꿀 때는 `ticksToBars()` 를 씁니다
 * - 이름이 틀리면 아래 두 함수 중 하나가 던진 오류가 그대로 전해집니다
 * @param {string} division  '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'
 * @param {boolean} [triplet]  셋잇단 여부 (기본 false)
 * @returns {number} 한 칸의 tick 수
 */
export function snapStepTicks(division, triplet = false) {
  return triplet ? tripletTicks(division) : divisionTicks(division);
}

/**
 * tick 을 가장 가까운 격자 칸으로 맞춥니다 (S1-06 FR-206 그리드 스냅 동작).
 * - 격자 칸 = stepTicks 의 배수. tick ÷ step 을 반올림한 뒤 다시 step 을 곱합니다
 *   예: step 960 일 때 1,450 → 1,920 (가까운 칸), 400 → 0, 480 은 정확히 반이라 위(960)
 * - 스냅 Off 나 Alt(격자 무시)는 이 함수를 부르지 않고, 부르는 쪽이 1틱 단위로 처리합니다
 * - `snapTick(barsToTicks(bar), snapStepTicks('1/16'))` 처럼 위치·단위와 함께 씁니다
 * @param {number} tick  맞출 위치 (tick)
 * @param {number} stepTicks  한 칸의 tick 수 (`snapStepTicks()` 결과)
 * @returns {number} 맞춘 tick
 */
export function snapTick(tick, stepTicks) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  if (typeof stepTicks !== 'number' || !isFinite(stepTicks) || stepTicks <= 0) throw new RangeError('stepTicks 는 0 보다 큰 숫자여야 합니다: ' + stepTicks);
  return Math.round(tick / stepTicks) * stepTicks;
}

/**
 * 클립을 좌우로 끌었을 때의 새 시작 tick 을 돌려줍니다 (S1-06 FR-208 이동).
 * - 끈 거리(`deltaTicks`)를 더한 뒤 격자에 맞추고(`snapTick`), 마디 0 왼쪽으로는 못 갑니다
 *   예: 960 에서 +1,000 → 1,920,  960 에서 -5,000 → 0 (0 아래로 안 내려감)
 * - 오른쪽 끝(트랙 총 길이) 제한은 클립 여러 개를 함께 옮길 때 달라지므로 부르는 쪽에서 맡습니다
 * - Alt 로 격자를 무시할 때는 이 함수를 부르지 않고 부르는 쪽이 `Math.max(0, start + delta)` 로 처리합니다
 * @param {number} startTick  지금 시작 tick
 * @param {number} deltaTicks  끈 거리 (tick, 음수 가능)
 * @param {number} stepTicks  한 칸 tick (`snapStepTicks()` 결과, 격자를 무시할 땐 1)
 * @returns {number} 새 시작 tick (0 이상)
 */
export function moveClipStart(startTick, deltaTicks, stepTicks) {
  return Math.max(0, snapTick(startTick + deltaTicks, stepTicks));
}

/**
 * 클립 오른쪽 끝을 끌었을 때의 새 길이를 돌려줍니다 (S1-06 FR-208 길이 조절).
 * - 2026-10-14 사용자 결정: 최소 길이 = 한 칸(`stepTicks`). Alt 로 격자를 무시하면 `stepTicks` 가 1 이라 1틱까지 줄어듭니다
 *   예: 길이 1,920 에서 -700 → 960 (한 칸),  더 줄여도 960 에서 멈춤
 * - 격자에 맞춘 뒤 최소 칸보다 작으면 최소 칸으로 올립니다. 0 이나 음수 길이가 되지 않습니다
 * - 최소보다 더 끌어도 클립은 지워지지 않고 그 자리에서 멈춥니다. 삭제는 Delete 키가 맡습니다
 * @param {number} lengthTick  지금 길이 (tick)
 * @param {number} deltaTicks  끈 거리 (tick, 오른쪽이 양수)
 * @param {number} stepTicks  한 칸 tick (`snapStepTicks()` 결과, Alt 는 1)
 * @returns {number} 새 길이 (최소 `stepTicks`)
 */
export function resizeClipLength(lengthTick, deltaTicks, stepTicks) {
  return Math.max(stepTicks, snapTick(lengthTick + deltaTicks, stepTicks));
}

/**
 * 클립 왼쪽 끝을 끌었을 때의 새 시작·길이·오프셋을 돌려줍니다 (S1-06 FR-208 오디오 트리밍).
 * - 2026-10-14 사용자 결정
 *   줄이기: 오른쪽 끝과 같은 규칙. 최소 한 칸(`stepTicks`)이고, Alt 면 `stepTicks` 가 1 이라 1틱까지 줄어듭니다
 *   늘리기: 원본 처음(`sourceStartTick`)과 마디 0 에 닿을 때까지. 그보다 더 왼쪽으로는 못 갑니다
 * - `sourceStartTick` = 원본 소스의 시작이 타임라인 어디에 놓이는지(틱). 오디오 클립은 `startTick - offsetTick`, MIDI 처럼 원본이 없으면 `null` 입니다
 *   원본이 없으면(`null`) 늘리기 한계는 마디 0 뿐이고 오프셋은 늘 0 입니다
 * - 격자에 맞춘 뒤 한계 안으로 당깁니다. 세 값은 `start - startTick` 만큼 함께 움직여 오디오가 제자리에 고정됩니다
 * @param {number} startTick  지금 시작 tick
 * @param {number} lengthTick  지금 길이 (tick)
 * @param {number} deltaTicks  끈 거리 (tick, 왼쪽이 음수)
 * @param {number} stepTicks  한 칸 tick (`snapStepTicks()` 결과, Alt 는 1)
 * @param {number|null} sourceStartTick  원본 처음의 타임라인 위치 (없으면 null)
 * @returns {{start: number, length: number, offset: number}} 새 값
 */
export function trimClipLeft(startTick, lengthTick, deltaTicks, stepTicks, sourceStartTick) {
  const minLength = stepTicks;
  const minStart = sourceStartTick == null ? 0 : Math.max(0, sourceStartTick);
  const maxStart = startTick + lengthTick - minLength;
  let start = snapTick(startTick + deltaTicks, stepTicks);
  if (start < minStart) start = minStart;
  if (start > maxStart) start = maxStart;
  return {
    start: start,
    length: lengthTick - (start - startTick),
    offset: sourceStartTick == null ? 0 : start - sourceStartTick,
  };
}

/**
 * 클립을 클릭 지점(`atTick`)에서 둘로 가릅니다 (S1-06 FR-208 분할).
 * - 자른 지점은 격자(`snapTick`)에 맞춘 뒤, 양쪽이 각각 한 칸(`stepTicks`) 이상일 때만 가릅니다
 *   두 토막 중 하나라도 한 칸보다 짧으면 가르지 않고 `null` 을 돌려줍니다(부르는 쪽은 그냥 무시)
 * - 오디오는 오른쪽 토막의 `offset` 이 왼쪽 길이만큼 커집니다(원본에서 더 건너뜀). `sourceStartTick` 규칙은 `trimClipLeft()` 와 같습니다
 * - 왼쪽 토막은 원본 시작·오프셋 그대로, 오른쪽 토막은 자른 지점부터 이어집니다
 * @param {number} startTick  클립 시작 tick
 * @param {number} lengthTick  클립 길이 (tick)
 * @param {number} atTick  자를 위치 (tick)
 * @param {number} stepTicks  한 칸 tick (`snapStepTicks()` 결과, Alt 는 1)
 * @param {number|null} sourceStartTick  원본 처음의 타임라인 위치 (없으면 null)
 * @returns {{left: {start: number, length: number, offset: number}, right: {start: number, length: number, offset: number}}|null}
 */
export function splitClip(startTick, lengthTick, atTick, stepTicks, sourceStartTick) {
  const at = snapTick(atTick, stepTicks);
  const leftLength = at - startTick;
  const rightLength = startTick + lengthTick - at;
  if (leftLength < stepTicks || rightLength < stepTicks) return null;
  const offset = (t) => (sourceStartTick == null ? 0 : t - sourceStartTick);
  return {
    left: { start: startTick, length: leftLength, offset: offset(startTick) },
    right: { start: at, length: rightLength, offset: offset(at) },
  };
}

/**
 * 클립을 복제할 때 복제본의 시작 tick 을 돌려줍니다 (S1-06 FR-208 복제, Ctrl+D).
 * - 복제본은 원본 **바로 뒤**에 붙습니다: 원본 시작 + 원본 길이
 *   예: 시작 960 · 길이 1,920 → 복제본 시작 2,880
 * - 둘 다 격자 위 값이라 결과도 격자 위에 놓입니다(따로 스냅하지 않습니다)
 * - 길이·오프셋은 원본과 같으므로 시작만 돌려줍니다. 부르는 쪽이 이 위치에 클립을 하나 더 만듭니다
 * @param {number} startTick  원본 시작 tick
 * @param {number} lengthTick  원본 길이 (tick)
 * @returns {number} 복제본 시작 tick
 */
export function duplicateClipStart(startTick, lengthTick) {
  if (typeof startTick !== 'number' || !isFinite(startTick)) throw new RangeError('startTick 은 유한한 숫자여야 합니다: ' + startTick);
  if (typeof lengthTick !== 'number' || !isFinite(lengthTick) || lengthTick <= 0) throw new RangeError('lengthTick 은 0 보다 큰 숫자여야 합니다: ' + lengthTick);
  return startTick + lengthTick;
}

/**
 * 가로 줌 배율을 한계 안으로 맞춥니다 (S1-06 FR-209 가로 줌).
 * - 배율 1 = 1마디 28.8px. 클수록 마디가 넓어집니다(확대), 작을수록 좁아집니다(축소)
 * - 최소는 `ZOOM_MIN`(0.25) 과 **화면 맞춤 배율**(`fitZoom`) 중 큰 쪽입니다. 화면보다 더 축소하면 빈 공간만 늘어납니다
 * - 최대는 `ZOOM_MAX`(12) 입니다. `fitZoom` 이 이보다 크면(곡이 아주 짧아 화면에 다 들어옴) 12 로 눌러 씁니다
 * - `fitZoom` 을 안 주면 최소는 `ZOOM_MIN` 입니다
 * @param {number} zoom  요청한 배율
 * @param {number} [fitZoom]  화면 맞춤 배율 (곡 전체가 화면에 들어오는 배율)
 * @returns {number} 한계 안으로 맞춘 배율
 */
export function clampZoom(zoom, fitZoom) {
  if (typeof zoom !== 'number' || !isFinite(zoom)) throw new RangeError('zoom 은 유한한 숫자여야 합니다: ' + zoom);
  const fit = (typeof fitZoom === 'number' && isFinite(fitZoom)) ? fitZoom : ZOOM_MIN;
  const lo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, fit));
  return Math.min(Math.max(zoom, lo), ZOOM_MAX);
}

/**
 * 가로 줌으로 마디 폭이 바뀔 때, 마우스 아래 지점이 화면에서 안 움직이게 할 스크롤 위치를 돌려줍니다 (S1-06 FR-209).
 * - 마우스 아래에 있던 마디 위치를 먼저 구하고(`barAtAnchor`), 폭이 바뀐 뒤 같은 화면 x 에 오도록 스크롤을 옮깁니다
 *   예: 헤드 200, 스크롤 0, 마우스 300, 폭 100→200 → 새 스크롤 100
 * - 왼쪽 헤드(트랙 이름칸) 폭(`headWidth`)은 줌과 무관하게 고정이라 빼고 계산합니다
 * - 결과가 음수여도 그대로 돌려줍니다. 보이는 범위로 자르는 일은 스크롤 영역(`scrollLeft`)이 맡습니다
 * @param {number} scrollLeft  지금 가로 스크롤 위치 (px)
 * @param {number} anchorX  마우스 x (스크롤 영역 왼쪽 기준, px)
 * @param {number} headWidth  왼쪽 헤드 폭 (px)
 * @param {number} oldBarWidth  줌 전 한 마디 폭 (px)
 * @param {number} newBarWidth  줌 후 한 마디 폭 (px)
 * @returns {number} 새 가로 스크롤 위치 (px)
 */
export function zoomScrollLeft(scrollLeft, anchorX, headWidth, oldBarWidth, newBarWidth) {
  const nums = [scrollLeft, anchorX, headWidth, newBarWidth];
  if (nums.some((n) => typeof n !== 'number' || !isFinite(n))) throw new RangeError('줌 스크롤 인자는 유한한 숫자여야 합니다');
  if (typeof oldBarWidth !== 'number' || !isFinite(oldBarWidth) || oldBarWidth <= 0) throw new RangeError('oldBarWidth 는 0 보다 큰 숫자여야 합니다: ' + oldBarWidth);
  const barAtAnchor = (scrollLeft + anchorX - headWidth) / oldBarWidth;
  return headWidth + barAtAnchor * newBarWidth - anchorX;
}

/**
 * 세로 줌: 트랙 높이를 한 단계 키우거나 줄인 다음 높이를 돌려줍니다 (S1-06 FR-209 세로 줌).
 * - 단계는 프로토타입 그대로 `TRACK_H_STEPS`(28·36·44·56·72·96·128·160·200 px)입니다. 44px 이 기본입니다
 * - `dir` 이 0보다 크면 한 단계 크게, 아니면 한 단계 작게. 더 갈 곳이 없으면 `null` 입니다
 *   예: 44 에서 +1 → 56, -1 → 36,  28 에서 -1 → null,  200 에서 +1 → null
 * - 지금 높이가 단계 사이(예: 50)여도 0.5px 여유를 두어 가까운 단계로 갑니다
 * @param {number} currentPx  지금 트랙 높이 (px)
 * @param {number} dir  방향 (양수 = 크게, 그 외 = 작게)
 * @returns {number|null} 다음 트랙 높이 (px) 또는 없으면 null
 */
export function stepTrackHeight(currentPx, dir) {
  if (typeof currentPx !== 'number' || !isFinite(currentPx)) throw new RangeError('currentPx 는 유한한 숫자여야 합니다: ' + currentPx);
  const up = dir > 0;
  const next = up
    ? TRACK_H_STEPS.find((h) => h > currentPx + 0.5)
    : TRACK_H_STEPS.slice().reverse().find((h) => h < currentPx - 0.5);
  return next == null ? null : next;
}

/**
 * 새 트랙에 붙일 번호를 돌려줍니다 (S1-06 FR-207 트랙 추가).
 * - 번호 = 지금 트랙 번호 중 **가장 큰 값 + 1**. 트랙이 없으면 1 입니다
 *   예: [1, 2, 3] → 4,  [1, 3] → 4,  [] → 1
 * - 그룹 트랙처럼 번호가 없는 줄은 세지 않습니다(숫자가 아니면 건너뜀)
 * - 프로토타입 `createTrack()` 이 쓰던 규칙 그대로입니다 (`Math.max(0, …) + 1`)
 * @param {number[]} numbers  지금 트랙들의 번호 (번호 없는 줄은 아무 값이나 무시됨)
 * @returns {number} 새 트랙 번호
 */
export function nextTrackNumber(numbers) {
  if (!Array.isArray(numbers)) throw new RangeError('numbers 는 배열이어야 합니다');
  let max = 0;
  for (const n of numbers) {
    if (typeof n === 'number' && isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * 트랙을 지운 뒤 번호를 다시 매긴 표(옛 번호 → 새 번호)를 돌려줍니다 (S1-06 FR-207 트랙 삭제).
 * - 남은 트랙을 **위에서부터 차례로 1, 2, 3 …** 으로 다시 매깁니다(번호 = 위치).
 *   예: [1, 3, 4] (2번 삭제됨) → 1→1, 3→2, 4→3
 * - 그룹 트랙처럼 번호가 없는 줄(숫자가 아닌 값)은 건너뜁니다. 그 줄은 번호를 세지 않고 다음 줄 번호도 밀리지 않습니다
 *   예: [1, null, 3] → 1→1, 3→2
 * - 이미 차례대로면 옛 번호 = 새 번호인 표가 나옵니다(1→1, 2→2 …)
 * - 번호는 서로 다르다고 봅니다(화면에 보이는 트랙 번호). 같은 번호가 두 번 오면 뒤 값이 앞 값을 덮습니다
 * @param {number[]} numbers  지금 트랙들의 번호 (위에서 아래 순서, 번호 없는 줄은 아무 값이나)
 * @returns {Map<number, number>} 옛 번호 → 새 번호
 */
export function renumberMap(numbers) {
  if (!Array.isArray(numbers)) throw new RangeError('numbers 는 배열이어야 합니다');
  const map = new Map();
  let n = 0;
  for (const old of numbers) {
    if (typeof old !== 'number' || !isFinite(old) || old <= 0) continue;
    n += 1;
    map.set(old, n);
  }
  return map;
}

/**
 * 목록에서 항목 하나를 다른 자리로 옮긴 새 목록을 돌려줍니다 (S1-06 FR-207 트랙 순서 드래그).
 * - `from` 자리 항목을 빼서 `to` 자리에 끼워 넣습니다. 원래 목록은 그대로 두고 새 목록을 만듭니다
 *   예: [Kick, Bass, Lead] 에서 0번을 2번으로 → [Bass, Lead, Kick]
 * - `to` 는 **옮긴 뒤 자리**(0부터) 입니다. 빼고 나서 끼우므로 헷갈리지 않습니다
 * - 트랙 번호는 자리에서 나오므로, 옮긴 뒤 `renumberMap()` 으로 번호를 다시 매깁니다
 * - `from` 과 `to` 는 0 이상 목록 길이 미만의 정수여야 합니다
 * @param {Array} items  원래 목록
 * @param {number} from  옮길 항목의 지금 자리 (0부터)
 * @param {number} to  옮긴 뒤 자리 (0부터)
 * @returns {Array} 새 목록
 */
export function reorderItems(items, from, to) {
  if (!Array.isArray(items)) throw new RangeError('items 는 배열이어야 합니다');
  const n = items.length;
  if (!Number.isInteger(from) || from < 0 || from >= n) throw new RangeError('from 자리가 범위 밖입니다: ' + from);
  if (!Number.isInteger(to) || to < 0 || to >= n) throw new RangeError('to 자리가 범위 밖입니다: ' + to);
  const out = items.slice();
  const moved = out.splice(from, 1)[0];
  out.splice(to, 0, moved);
  return out;
}

/**
 * 트랙에 붙일 색 이름을 돌려줍니다 (S1-06 FR-207 트랙 색상).
 * - 오디오 트랙은 늘 `'audio'`(파형 색 한 가지)입니다
 * - MIDI 트랙은 고른 색(`color`)이 있으면 그것, 없으면 **번호로 다섯 색을 돌려 씁니다**: 1→'1', 2→'2', …, 5→'5', 6→'1', 7→'2' …
 *   `((번호 − 1) % 5) + 1` — 프로토타입 `createTrack()` 규칙 그대로입니다
 * - 돌려주는 값은 색 번호 문자열(`'1'`~`'5'`) 또는 `'audio'` 입니다. 실제 색값은 CSS(`--tc-1`~`--tc-5`)가 정합니다
 * @param {'audio'|'midi'} kind  트랙 종류
 * @param {number} num  트랙 번호 (MIDI일 때 1 이상)
 * @param {string} [color]  고른 색 (있으면 그것을 씀, MIDI)
 * @returns {string} 색 이름 (`'1'`~`'5'` 또는 `'audio'`)
 */
export function trackColor(kind, num, color) {
  if (kind === 'audio') return 'audio';
  if (typeof num !== 'number' || !isFinite(num) || num < 1) throw new RangeError('트랙 번호는 1 이상이어야 합니다: ' + num);
  return color || String(((num - 1) % 5) + 1);
}

/**
 * 오디오 클립 파형을 클립 폭(칸)에 맞게 접어 한 칸마다 진폭을 돌려줍니다 (S1-06 FR-210 오디오 클립 파형).
 * - `peaks` 는 원본 소스 전체를 같은 간격으로 담은 진폭 배열(0~1)입니다. 소스 길이(`sourceLengthTick`)에 걸쳐 있습니다
 * - 클립은 소스의 `offsetTick` 부터 `lengthTick` 만큼을 보여 줍니다(트리밍 반영). 이것을 가로 `columns` 칸으로 나눕니다
 * - 한 칸이 덮는 소스 구간의 진폭 중 **가장 큰 값**(절댓값)을 그 칸 값으로 씁니다
 *   예: peaks [0.1, 0.5, 0.9, 0.3], 소스 4틱·offset 0·길이 4 → 4칸 [0.1, 0.5, 0.9, 0.3], 2칸 [0.5, 0.9]
 * - peaks 가 비면 0으로 채운 칸 배열을 돌려줍니다(파형 자리만 남김)
 * @param {number[]} peaks  소스 전체 진폭 (0~1), 앞에서부터 고르게 분포
 * @param {number} offsetTick  클립이 보여 주는 소스 시작 (tick)
 * @param {number} lengthTick  클립이 보여 주는 소스 길이 (tick)
 * @param {number} sourceLengthTick  소스 전체 길이 (tick)
 * @param {number} columns  클립 폭 (칸 수, 1 이상 정수)
 * @returns {number[]} 칸마다의 진폭 (길이 `columns`)
 */
export function waveformColumns(peaks, offsetTick, lengthTick, sourceLengthTick, columns) {
  if (!Array.isArray(peaks)) throw new RangeError('peaks 는 배열이어야 합니다');
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError('columns 는 1 이상의 정수여야 합니다: ' + columns);
  if (typeof sourceLengthTick !== 'number' || !isFinite(sourceLengthTick) || sourceLengthTick <= 0) throw new RangeError('sourceLengthTick 는 0 보다 큰 숫자여야 합니다: ' + sourceLengthTick);
  const out = new Array(columns).fill(0);
  const n = peaks.length;
  if (n === 0) return out;
  const peaksPerTick = n / sourceLengthTick;
  for (let c = 0; c < columns; c++) {
    const t0 = (offsetTick + (c / columns) * lengthTick) * peaksPerTick;
    const t1 = (offsetTick + ((c + 1) / columns) * lengthTick) * peaksPerTick;
    let i0 = Math.floor(t0);
    let i1 = Math.ceil(t1);
    if (i1 <= i0) i1 = i0 + 1;
    i0 = Math.max(0, Math.min(n - 1, i0));
    i1 = Math.max(i0 + 1, Math.min(n, i1));
    let max = 0;
    for (let i = i0; i < i1; i++) {
      const v = Math.abs(peaks[i]);
      if (v > max) max = v;
    }
    out[c] = max;
  }
  return out;
}

/**
 * 파형 칸(진폭 0~1)을 가운데를 기준으로 위·아래 좌표로 펼칩니다 (S1-06 FR-210 오디오 클립 파형).
 * - 각 칸을 세로 막대 하나로 봅니다. 가운데(`height / 2`)에서 진폭만큼 위·아래로 뻗습니다
 * - 캔버스에 세로 선으로 그립니다: `x = 칸 번호 × 칸 너비`, `moveTo(x, top)`, `lineTo(x, bottom)`
 *   예: 칸 [1, 0, 0.5], 높이 10 → [[0, 10], [5, 5], [2.5, 7.5]]  (가운데 5)
 * - 진폭은 0~1로 잘라 씁니다(넘으면 1, 음수·숫자 아님은 0). 소리 없는 칸은 가운데 한 줄이 됩니다
 * @param {number[]} columns  칸마다의 진폭 (0~1), `waveformColumns()` 결과
 * @param {number} height  파형 그릴 높이 (px, 0 보다 큼)
 * @returns {number[][]} 칸마다 `[top, bottom]` 좌표 (top ≤ bottom)
 */
export function waveformBars(columns, height) {
  if (!Array.isArray(columns)) throw new RangeError('columns 는 배열이어야 합니다');
  if (typeof height !== 'number' || !isFinite(height) || height <= 0) throw new RangeError('height 는 0 보다 큰 숫자여야 합니다: ' + height);
  const midY = height / 2;
  const out = new Array(columns.length);
  for (let i = 0; i < columns.length; i++) {
    let amp = columns[i];
    if (typeof amp !== 'number' || !isFinite(amp) || amp < 0) amp = 0;
    if (amp > 1) amp = 1;
    out[i] = [midY - amp * midY, midY + amp * midY];
  }
  return out;
}

/**
 * 파형 막대 좌표를 캔버스에 세로 선으로 그립니다 (S1-06 FR-210 오디오 클립 파형).
 * - `waveformBars()` 가 만든 `[top, bottom]` 배열을 받아 칸마다 `moveTo` → `lineTo` 로 잇습니다
 * - 칸의 x 는 **칸 가운데**(`칸 번호 × 칸 너비 + 칸 너비 / 2`)로 잡습니다. 막대가 칸 한가운데 서게 합니다
 * - 색·굵기(`strokeStyle`·`lineWidth`)는 부르는 쪽이 미리 정합니다. 이 함수는 모양만 그립니다
 *   예: bars [[0,10],[5,5]], 칸 너비 4 → x=2 와 x=6 에 세로 선
 * @param {CanvasRenderingContext2D} ctx  캔버스 2D 컨텍스트
 * @param {number[][]} bars  칸마다 `[top, bottom]` 좌표, `waveformBars()` 결과
 * @param {number} colWidth  칸 너비 (px, 0 보다 큼)
 */
export function drawWaveform(ctx, bars, colWidth) {
  if (!ctx || typeof ctx.beginPath !== 'function') throw new RangeError('ctx 는 캔버스 2D 컨텍스트여야 합니다');
  if (!Array.isArray(bars)) throw new RangeError('bars 는 배열이어야 합니다');
  if (typeof colWidth !== 'number' || !isFinite(colWidth) || colWidth <= 0) throw new RangeError('colWidth 는 0 보다 큰 숫자여야 합니다: ' + colWidth);
  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = i * colWidth + colWidth / 2;
    const bar = bars[i];
    ctx.moveTo(x, bar[0]);
    ctx.lineTo(x, bar[1]);
  }
  ctx.stroke();
}

/* ───────────── 오디오 클립 파형 (FR-210) ───────────── */

/** 자리표시 파형 진폭 수 (소스 하나를 몇 칸으로 볼지) — S1-10 에서 실제 peaks 로 교체됩니다 */
const PEAK_COUNT = 512;

/** 샘플 이름별 자리표시 peaks — 같은 이름은 늘 같은 모양이 되도록 담아 둡니다 */
const peaksCache = new Map();

/** 이름을 32비트 정수로 (FNV-1a) — 파형 모양의 씨앗 */
function hashName(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * 실제 샘플이 없을 때 쓰는 **자리표시 파형**을 이름으로 만듭니다 (S1-06 FR-210 배선용).
 * - 이름을 씨앗으로 한 난수라 같은 샘플은 늘 같은 모양입니다(새로 그려도 흔들리지 않음)
 * - 큰 흐름(사인)에 잔결을 섞고, 가끔 강한 타격을 넣어 파형처럼 보이게 합니다. 앞뒤는 살짝 페이드
 * - S1-10 에서 진짜 peaks(디코딩 결과)가 오면 이 함수 대신 그 값을 넘깁니다
 * @param {string} name  샘플 이름
 * @returns {number[]} 소스 전체 진폭 (0~1), 길이 `PEAK_COUNT`
 */
function placeholderPeaks(name) {
  const hit = peaksCache.get(name);
  if (hit) return hit;
  let seed = hashName(name) || 1;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const peaks = new Array(PEAK_COUNT);
  for (let i = 0; i < PEAK_COUNT; i++) {
    const p = i / PEAK_COUNT;
    const body = 0.30 + 0.35 * Math.sin(p * Math.PI * 6) * Math.sin(p * Math.PI * 1.7);
    let v = Math.abs(body) * (0.55 + 0.9 * rand());
    if (rand() > 0.86) v = 1;                                     // 가끔 강한 타격
    const fade = Math.min(1, p * 20) * Math.min(1, (1 - p) * 20); // 앞뒤 페이드
    peaks[i] = Math.max(0.02, Math.min(1, v * fade));
  }
  peaksCache.set(name, peaks);
  return peaks;
}

/**
 * 오디오 클립 하나의 파형을 그 미리보기 캔버스에 그립니다 (S1-06 FR-210).
 * - 클립 폭(`--l`)·오프셋(`--o`)을 tick 으로 바꿔 `waveformColumns` → `waveformBars` → `drawWaveform` 순으로 넘깁니다
 * - 자리표시라 소스 전체 길이는 "지금 보이는 구간 + 앞에서 건너뛴 만큼"으로 봅니다(트리밍하면 파형이 밀림)
 * - 칸 수는 캔버스 CSS 폭만큼(1칸 ≈ 1px). 캔버스는 화면 배율(dpr)에 맞춰 늘려 선명하게 그립니다
 * @param {HTMLElement} clip  오디오 클립 (`.sq-clip--audio`)
 * @param {number} dpr  화면 배율 (window.devicePixelRatio)
 */
function drawClipWaveform(clip, dpr) {
  const canvas = clip.querySelector('.sq-clip__preview');
  if (!canvas) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pw, ph);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const nameEl = clip.querySelector('.sq-clip__name');
  const name = (nameEl ? nameEl.textContent : '').replace(/^[▤⇥]\s*/, '').trim();
  const lengthTick = barsToTicks(parseFloat(clip.style.getPropertyValue('--l')) || 1);
  const offsetTick = barsToTicks(parseFloat(clip.style.getPropertyValue('--o')) || 0);
  const sourceLengthTick = offsetTick + lengthTick;
  const columns = Math.max(1, Math.min(4000, Math.round(w)));
  const cols = waveformColumns(placeholderPeaks(name), offsetTick, lengthTick, sourceLengthTick, columns);
  const bars = waveformBars(cols, h);
  ctx.strokeStyle = getComputedStyle(clip).getPropertyValue('--tc').trim() || 'currentColor';
  ctx.lineWidth = 1;
  drawWaveform(ctx, bars, w / columns);
}

/** 편곡의 모든 오디오 클립 파형을 다시 그림 */
function drawWaveforms() {
  const c = zoomCtx;
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.lanes.querySelectorAll('.sq-clip--audio').forEach((clip) => drawClipWaveform(clip, dpr));
}

/**
 * 오디오 클립 파형 배선 (S1-06 FR-210).
 * - 처음 한 번 그리고, 클립이 생기거나 지워지거나 `--s`·`--l`·`--o` 가 바뀌면 다시 그립니다(MutationObserver)
 * - 확대·스크롤로 격자를 다시 그릴 때(`requestGrid`)에도 함께 그립니다(클립 폭이 바뀌므로)
 * @param {{lanes: HTMLElement}} param0
 */
function initWaveforms({ lanes }) {
  new MutationObserver(requestGrid).observe(lanes, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  requestGrid();
}

/**
 * 스냅 메뉴에 넣을 분할 목록을 돌려줍니다 (S1-06 FR-206 그리드 스냅: 1/1~1/32 · 셋잇단 포함).
 * - `DIVISION_DEN` 의 분할(1/1 · 1/2 · 1/4 · 1/8 · 1/16 · 1/32)마다 **보통**과 **셋잇단** 두 줄을 만듭니다
 * - 셋잇단 이름은 뒤에 `T` 를 붙입니다(`'1/16T'`). 값(`ticks`)은 `snapStepTicks()` 로 구합니다
 * - 화면 순서는 큰 분할(1/1)부터 작은 분할(1/32)까지, 각 분할은 보통 다음 셋잇단 순서입니다
 *   예: 1/1(3840) · 1/1T(1280) · 1/2(1920) · 1/2T(640) · … · 1/32(120) · 1/32T(40)
 * @returns {{division: string, triplet: boolean, label: string, ticks: number}[]} 메뉴 줄 목록
 */
export function snapOptions() {
  const out = [];
  for (const division of Object.keys(DIVISION_DEN)) {
    out.push({ division, triplet: false, label: division, ticks: snapStepTicks(division, false) });
    out.push({ division, triplet: true, label: division + 'T', ticks: snapStepTicks(division, true) });
  }
  return out;
}

/** 지금 고른 스냅 분할 — Snap 메뉴에서 명시적으로 고른 값. 기본은 1/16 (보통) */
let snapDivision = '1/16';
let snapTriplet = false;

/**
 * 스냅 분할 선택을 담아 둡니다 (S1-06 FR-206 그리드 스냅 메뉴에서 고른 값 저장).
 * - Snap 메뉴에서 "1/16" 같은 분할과 ³ Triplet 여부를 고르면 이 함수로 담습니다
 * - 담기 전에 이름을 `divisionTicks()` 로 확인합니다. 목록에 없는 이름이면 오류를 던지고 **담지 않습니다**(이전 값 유지)
 * - 돌려주는 값은 담은 뒤의 `{division, triplet}` 입니다
 * @param {string} division  '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'
 * @param {boolean} [triplet]  셋잇단 여부 (기본 false)
 * @returns {{division: string, triplet: boolean}} 담은 값
 */
export function setSnapDivision(division, triplet = false) {
  divisionTicks(division);
  snapDivision = division;
  snapTriplet = triplet ? true : false;
  snapMode = 'division';
  updateSnapButton();
  refreshSnapMenu();
  notifyGridSettings();
  return { division: snapDivision, triplet: snapTriplet };
}

/**
 * 지금 고른 스냅 분할을 돌려줍니다 (S1-06 FR-206 — 저장한 값 조회).
 * - `setSnapDivision()` 으로 담은 값(또는 기본값)을 그대로 돌려줍니다
 * @returns {{division: string, triplet: boolean}} 지금 값
 */
export function getSnapDivision() {
  return { division: snapDivision, triplet: snapTriplet };
}

/**
 * 고른 스냅 분할을 **마디 단위**로 돌려줍니다 (S1-06 FR-206 — 끌기 코드에 넘길 값).
 * - 끌기 코드(`snap`·`snapUnit`)는 마디 단위를 씁니다. 이 함수가 고른 분할을 그 단위로 바꿔 줍니다
 * - `divisionTicks()`(tick 길이) 를 `TICKS_PER_BAR` 로 나눕니다. 4/4 에서 1/n 음표 = 1/n 마디입니다
 *   예: '1/16' → 240 tick ÷ 3840 = 0.0625 마디, '1/4' → 960 ÷ 3840 = 0.25 마디, '1/1' → 1 마디
 * - 셋잇단이면 `tripletTicks()`(÷3) 를 나눠 마디 단위로 씁니다
 * - 이름이 틀리면 `divisionTicks()` 가 던진 오류가 그대로 전해집니다
 * @param {string} division  '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'
 * @param {boolean} [triplet]  셋잇단 여부 (기본 false)
 * @returns {number} 스냅 한 칸 (마디 단위)
 */
export function divisionBars(division, triplet = false) {
  return snapStepTicks(division, triplet) / TICKS_PER_BAR;
}

/** 스냅 방식: 'line' = 보이는 격자선에 붙음 · 'off' = 격자 무시 · 'division' = 고른 분할 (상단 Snap ▾) */
let snapMode = 'line';

/**
 * 지금 붙을 스냅 한 칸(마디 단위)을 돌려줍니다 (S1-06 FR-206 — 방식을 한 값으로 모음).
 * - Alt(free) 를 누른 채 끌거나 Snaps Off 이면 1틱입니다
 * - 분할을 직접 골랐으면(`'division'`) 고른 분할(`divisionBars()`)을 씁니다
 * - 그 밖에는 확대에 따라 자동(`getSnap()`)입니다
 * @param {boolean} [free]  Alt 를 누른 채 끄는 중 (기본 false)
 * @returns {number} 스냅 한 칸 (마디 단위)
 */
export function snapUnitNow(free = false) {
  if (free || snapMode === 'off') return TICK;
  if (snapMode === 'division') return divisionBars(snapDivision, snapTriplet);
  return getSnap();
}

/** 지금 붙는 단위 — free(끄는 중 Alt) 이거나 스냅 Off 이면 1틱 */
const snapUnit = (free) => snapUnitNow(free);

/** 가장 가까운 격자선으로 (free = Alt 를 누른 채 끄는 중) */
const snap = (bar, free = false) => { const u = snapUnit(free); return round(Math.round(bar / u) * u); };

/** 왼쪽 격자선으로 (목록에서 놓을 때 — 포인터가 있는 칸의 시작) */
const floorSnap = (bar, free = false) => { const u = snapUnit(free); return round(Math.floor(bar / u + 1e-9) * u); };
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** 트랙 종류 — data-color="audio" 가 오디오 트랙. 그룹 · 리턴 · MASTER 에는 클립을 놓지 않음 */
function laneKind(lane) {
  const track = lane.closest('.sq-track');
  if (!track || track.matches('.sq-track--group, .sq-track--return, .sq-track--master')) return null;
  return track.dataset.color === 'audio' ? 'audio' : 'midi';
}

/** 끄는 중 가장자리에 가까우면 자동 스크롤 (왼쪽은 트랙 머리 오른쪽 끝 기준) */
function edgeScroll(scroll, x) {
  const r = scroll.getBoundingClientRect();
  const head = scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  if (x > r.right - EDGE) scroll.scrollLeft += EDGE_SPEED;
  else if (x < r.left + head + EDGE) scroll.scrollLeft -= EDGE_SPEED;
}

/**
 * 클립 하나 만들기 (S1-06 FR-208) — studioNx.html 의 클립과 같은 모양.
 * 서버에서 온 클립이면 번호를 달아 둡니다 (S1-10a FR-2196) — 저장(PATCH·DELETE) 때 씁니다.
 * @param {{ kind: string, name: string, start: number, length: number,
 *   clipId?: number|string, patternId?: number|string, sampleId?: number|string }} param0
 * @returns {HTMLButtonElement}
 */
export function createClip({ kind, name, start, length, clipId, patternId, sampleId }) {
  const clip = document.createElement('button');
  clip.type = 'button';
  clip.className = `sq-clip sq-clip--${kind}`;
  clip.style.setProperty('--s', start);
  clip.style.setProperty('--l', length);
  if (clipId !== undefined && clipId !== null) clip.dataset.clipId = String(clipId);
  if (patternId !== undefined && patternId !== null) clip.dataset.patternId = String(patternId);
  if (sampleId !== undefined && sampleId !== null) clip.dataset.sampleId = String(sampleId);
  const label = document.createElement('span');
  label.className = 'sq-clip__name';
  label.textContent = `${kind === 'audio' ? '⇥' : '▤'} ${name}`;
  const preview = document.createElement('canvas');
  preview.className = 'sq-clip__preview';
  clip.append(label, preview);
  return clip;
}

/* ───────────── 1) 편곡 좌우 이동 ───────────── */

/** 마디 눈금에서 클릭한 x → 마디 (눈금 줄 왼쪽 = 0마디, Alt 면 스냅 없이). 클릭 = 플레이헤드 옮기기 */
function rulerBar(barEl, clientX, free, lanes) {
  return snap((clientX - barEl.getBoundingClientRect().left) / barWidth(lanes), free);
}

function initPan({ scroll, lanes }) {
  const PAN_AREA = '.sq-ruler__bars, .sq-markers__track, .sq-track__lane, .sq-fill__lane';
  let pan = null;

  scroll.addEventListener('pointerdown', (e) => {
    const middle = e.button === 1;
    if (!middle && e.button !== 0) return;
    // 왼쪽 버튼은 빈 곳에서만 (클립 · 마커 · 버튼 · 오토메이션 위는 제외)
    if (!middle && (!e.target.closest(PAN_AREA) || e.target.closest('button, .sq-auto, .sq-loop'))) return;
    // Select(E) 도구일 때 트랙 빈 곳 끌기는 영역 선택 (initMarquee) — 좌우 이동은 마디 줄 · 마커 줄 · 가운데 버튼으로
    if (!middle && currentTool === 'select' && e.target.closest('.sq-track__lane, .sq-fill__lane')) return;
    // Paint · Delete · Mute · Slip · Slice · Zoom 도구는 트랙 위에서 각자 동작 (initToolActions)
    if (!middle && TOOL_ACTS.has(currentTool) && e.target.closest('.sq-track__lane, .sq-fill__lane')) return;
    pan = {
      x: e.clientX, left: scroll.scrollLeft, id: e.pointerId, moved: false,
      clear: !middle && !e.ctrlKey && !e.metaKey && !!e.target.closest('.sq-track__lane, .sq-fill__lane'),
      // 마디 눈금을 그냥 클릭(끌지 않음) → 플레이헤드를 그 자리로 (FR-2331)
      ruler: !middle ? e.target.closest('.sq-ruler__bars') : null,
      // Draw 도구로 빈 트랙 칸을 클릭(끌지 않음) → 그 자리에 클립 놓기
      draw: !middle && currentTool === 'draw' ? { lane: e.target.closest('.sq-track__lane'), x: e.clientX, free: e.altKey } : null,
    };
    if (middle) e.preventDefault();   // 가운데 버튼 자동 스크롤 막기
  });
  scroll.addEventListener('pointermove', (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    const dx = e.clientX - pan.x;
    if (!pan.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!pan.moved) {
      pan.moved = true;
      scroll.setPointerCapture(e.pointerId);
      scroll.classList.add('is-panning');
    }
    scroll.scrollLeft = pan.left - dx;
  });
  const end = (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    if (pan.moved) scroll.releasePointerCapture(e.pointerId);
    else if (pan.ruler) setPlayheadBar(clamp(rulerBar(pan.ruler, e.clientX, e.altKey, lanes), 0, totalBars(lanes)));
    else if (pan.draw?.lane && drawClipAt(pan.draw.lane, pan.draw.x, pan.draw.free)) { /* 놓음 */ }
    else if (pan.clear) clearSelection(scroll);   // 트랙 빈 곳을 그냥 클릭 → 선택 풀기
    scroll.classList.remove('is-panning');
    pan = null;
  };
  scroll.addEventListener('pointerup', end);
  scroll.addEventListener('pointercancel', end);
}

/* ───────────── 2) 클립 옮기기 ───────────── */

function initClipDrag({ scroll, lanes, onChange }) {
  let drag = null;
  const selected = () => [...lanes.querySelectorAll('.sq-clip.is-selected:not(.is-ghost)')];

  lanes.addEventListener('pointerdown', (e) => {
    const clip = e.target.closest('.sq-clip');
    if (!clip || e.button !== 0 || clip.classList.contains('is-ghost')) return;
    if (currentTool !== 'draw' && currentTool !== 'select') return;   // 다른 도구는 initToolActions
    setDrawTemplate(templateOf(clip));
    const multi = e.ctrlKey || e.metaKey;
    const wasSelected = clip.classList.contains('is-selected');
    // 끌기를 시작할 때 함께 움직일 클립: 선택된 클립을 잡으면 선택 전체, 아니면 (Ctrl 이면 선택 + 이것, 아니면 이것만)
    if (!wasSelected) {
      if (!multi) clearSelection(lanes);
      clip.classList.add('is-selected');
    }
    const rect = clip.getBoundingClientRect();
    const onLeft = e.clientX - rect.left <= EDGE_PX;    // 왼쪽 끝 손잡이 = 트리밍
    const onRight = rect.right - e.clientX <= EDGE_PX;  // 오른쪽 끝 손잡이 = 길이 조절
    drag = {
      clip, multi, wasSelected,
      mode: onRight ? 'resize' : onLeft ? 'trim' : 'move',
      id: e.pointerId,
      x: e.clientX,
      scrollLeft: scroll.scrollLeft,
      group: selected().map((c) => ({
        clip: c,
        start: parseFloat(c.style.getPropertyValue('--s')) || 0,
        length: parseFloat(c.style.getPropertyValue('--l')) || 1,
        offset: parseFloat(c.style.getPropertyValue('--o')) || 0,
      })),
      moved: false,
    };
    drag.primary = drag.group.find((g) => g.clip === clip);
    // 오디오는 원본 처음이 타임라인 어디인지(start − offset)를 알아야 늘리기 한계를 지킴. MIDI 는 원본이 없어 null
    drag.sourceStartTick = clip.classList.contains('sq-clip--audio')
      ? barsToTicks(drag.primary.start) - barsToTicks(drag.primary.offset)
      : null;
  });

  lanes.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x + (scroll.scrollLeft - drag.scrollLeft);
    if (!drag.moved && Math.abs(e.clientX - drag.x) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.clip.setPointerCapture(e.pointerId);
      if (drag.mode === 'move') drag.group.forEach((g) => g.clip.classList.add('is-dragging'));
      else drag.clip.classList.add('is-resizing');
    }
    // 오른쪽 끝 = 길이 조절 (S1-06 FR-208). 최소 한 칸까지 줄고, 스냅에 맞춰 늘고 줆
    if (drag.mode === 'resize') {
      const stepTicks = barsToTicks(snapUnit(e.altKey));            // Alt = 격자 무시(1틱)
      const deltaTicks = barsToTicks(dx / barWidth(lanes));
      const lenTick = resizeClipLength(barsToTicks(drag.primary.length), deltaTicks, stepTicks);
      drag.primary.clip.style.setProperty('--l', round(ticksToBars(lenTick)));
      edgeScroll(scroll, e.clientX);
      return;
    }
    // 왼쪽 끝 = 트리밍 (S1-06 FR-208). 시작·길이·오프셋이 함께 움직여 오디오가 제자리에 고정됨
    if (drag.mode === 'trim') {
      const stepTicks = barsToTicks(snapUnit(e.altKey));
      const deltaTicks = barsToTicks(dx / barWidth(lanes));
      const res = trimClipLeft(barsToTicks(drag.primary.start), barsToTicks(drag.primary.length), deltaTicks, stepTicks, drag.sourceStartTick);
      drag.primary.clip.style.setProperty('--s', round(ticksToBars(res.start)));
      drag.primary.clip.style.setProperty('--l', round(ticksToBars(res.length)));
      drag.primary.clip.style.setProperty('--o', round(ticksToBars(res.offset)));
      edgeScroll(scroll, e.clientX);
      return;
    }
    // 잡은 클립을 스냅에 맞춘 만큼(delta) 모두 같이 옮김 → 클립끼리 간격 유지
    // 맨 앞 클립이 0 아래로, 맨 뒤 클립이 곡 끝 너머로 가지 않게 delta 를 제한
    let delta = snap(drag.primary.start + dx / barWidth(lanes), e.altKey) - drag.primary.start;   // Alt = 격자 무시
    const minStart = Math.min(...drag.group.map((g) => g.start));
    const maxEnd = Math.max(...drag.group.map((g) => g.start + g.length));
    delta = clamp(delta, -minStart, totalBars(lanes) - maxEnd);
    drag.group.forEach((g) => g.clip.style.setProperty('--s', round(g.start + delta)));
    // 세로로는 옮기지 않음 — 클립은 자기 트랙 안에서만 (Ableton 트랙 관리 방식, 수정 사항2)
    edgeScroll(scroll, e.clientX);
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { clip, moved, mode } = drag;
    if (moved) {
      clip.releasePointerCapture(e.pointerId);
      if (mode === 'resize') {
        clip.classList.remove('is-resizing');
        const length = parseFloat(clip.style.getPropertyValue('--l'));
        if (length !== drag.primary.length) onChange({ type: 'resize', clip, trackId: clip.closest('.sq-track').dataset.trackId, start: drag.primary.start, length });
      } else if (mode === 'trim') {
        clip.classList.remove('is-resizing');
        const start = parseFloat(clip.style.getPropertyValue('--s'));
        const length = parseFloat(clip.style.getPropertyValue('--l'));
        const offset = parseFloat(clip.style.getPropertyValue('--o')) || 0;
        if (start !== drag.primary.start || length !== drag.primary.length) onChange({ type: 'trim', clip, trackId: clip.closest('.sq-track').dataset.trackId, start, length, offset });
      } else {
        drag.group.forEach((g) => {
          g.clip.classList.remove('is-dragging');
          const start = parseFloat(g.clip.style.getPropertyValue('--s'));
          if (start !== g.start) onChange({ type: 'move', clip: g.clip, trackId: g.clip.closest('.sq-track').dataset.trackId, start, length: g.length });
        });
      }
      // 끈 뒤 따라오는 click 은 무시 (선택이 바뀌지 않게)
      clip.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
    } else if (drag.multi) {
      // Ctrl+클릭 → 이 클립만 선택에 넣거나 뺌 (처음부터 선택돼 있었으면 뺌)
      if (drag.wasSelected) clip.classList.remove('is-selected');
    } else {
      // 그냥 클릭 → 이 클립만 선택
      clearSelection(lanes);
      clip.classList.add('is-selected');
    }
    drag = null;
  };
  lanes.addEventListener('pointerup', end);
  lanes.addEventListener('pointercancel', end);

  // Ctrl+A → 편곡의 클립 모두 선택 (입력칸에 커서가 있으면 원래대로 글자 전체 선택)
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a' || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    lanes.querySelectorAll('.sq-clip:not(.is-ghost)').forEach((c) => c.classList.add('is-selected'));
  });

  // Ctrl+D → 선택한 클립을 바로 오른쪽에 복제 (FR-208 복제). 새 복제본이 선택됨
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'd' || e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    const clips = [...lanes.querySelectorAll('.sq-clip.is-selected:not(.is-ghost)')];
    if (!clips.length) return;
    e.preventDefault();
    const copies = clips.map((c) => {
      const track = c.closest('.sq-track');
      const start = parseFloat(c.style.getPropertyValue('--s')) || 0;
      const length = parseFloat(c.style.getPropertyValue('--l')) || 1;
      const offset = parseFloat(c.style.getPropertyValue('--o')) || 0;
      const kind = c.classList.contains('sq-clip--audio') ? 'audio' : 'midi';
      const name = c.querySelector('.sq-clip__name').textContent.replace(/^[▤⇥]\s*/, '').trim();
      const newStart = clamp(ticksToBars(duplicateClipStart(barsToTicks(start), barsToTicks(length))), 0, totalBars(lanes) - length);
      const clip = createClip({ kind, name, start: newStart, length, patternId: c.dataset.patternId, sampleId: c.dataset.sampleId });
      if (offset) clip.style.setProperty('--o', offset);
      track.querySelector('.sq-track__lane').append(clip);
      onChange({ type: 'duplicate', clip, trackId: track.dataset.trackId, start: newStart, length, offset });
      return clip;
    });
    clearSelection(lanes);
    copies.forEach((c) => c.classList.add('is-selected'));
  });
}

/** 클립 선택 모두 풀기 */
function clearSelection(lanes) {
  lanes.querySelectorAll('.sq-clip.is-selected').forEach((c) => c.classList.remove('is-selected'));
}

/** 마디 값 소수점 정리 (셋잇단 1/12 · 1/24 이 0.0833333… 처럼 길어지지 않게) */
const round = (v) => Math.round(v * 1e6) / 1e6;

/* ───────────── 3) 왼쪽 목록 → 트랙 끌어 놓기 ───────────── */

function initListDrop({ scroll, lanes, onChange }) {
  let data = null;      // 끄는 항목 { kind, name, length, color }
  let ghost = null;     // 놓일 자리 미리보기
  let fillTarget = null;
  const KIND_LABEL = { audio: 'audio', midi: 'MIDI' };

  document.addEventListener('dragstart', (e) => {
    const item = e.target.closest?.('.sq-file[draggable="true"][data-kind]');
    if (!item) return;
    data = {
      kind: item.dataset.kind, name: item.dataset.name, length: parseFloat(item.dataset.bars) || 1, color: item.dataset.color,
      // 서버 번호 — MIDI 는 패턴, AUDIO 는 샘플 (S1-10a FR-2196). 없으면 null
      patternId: item.dataset.patternId || null,
      sampleId: item.dataset.sampleId || null,
    };
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(data));
    e.dataTransfer.setData('text/plain', data.name);
    e.dataTransfer.effectAllowed = 'copy';
  });

  const clearGhost = () => {
    ghost?.parentElement?.classList.remove('is-drop-target');
    ghost?.remove();
    ghost = null;
    fillTarget?.classList.remove('is-drop-new');
    fillTarget = null;
  };
  const startAt = (x, laneLike, free) => clamp(floorSnap((x - laneLike.getBoundingClientRect().left) / barWidth(lanes), free), 0, totalBars(lanes) - data.length);
  /** 빈 곳 = ＋ Add Track 줄 · 그 아래 빈 칸 */
  const emptyAreaOf = (t) => t.closest('.sq-fill, .sq-addrow');
  const fillLane = () => lanes.querySelector('.sq-fill__lane');

  lanes.addEventListener('dragover', (e) => {
    if (!data) return;
    const lane = e.target.closest('.sq-track__lane');
    const kind = lane ? laneKind(lane) : null;
    // ① 빈 곳 → 새 트랙
    if (!lane && emptyAreaOf(e.target)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (ghost) { ghost.parentElement?.classList.remove('is-drop-target'); ghost.remove(); ghost = null; }
      fillTarget = lanes.querySelector('.sq-fill');
      fillTarget.classList.add('is-drop-new');
      const at = startAt(e.clientX, fillLane(), e.altKey);
      fillTarget.style.setProperty('--drop-at', at);   // 안내 상자를 놓일 자리에
      fillTarget.dataset.dropLabel = `＋ New ${KIND_LABEL[data.kind]} track — “${data.name}” at bar ${Math.floor(at) + 1}`;
      edgeScroll(scroll, e.clientX);
      return;
    }
    fillTarget?.classList.remove('is-drop-new');
    fillTarget = null;
    // 그룹 · 리턴 · MASTER 에는 놓지 않음
    if (!lane || !kind) { clearGhost(); return; }
    // ② 같은 종류 → 그 트랙에, ③ 다른 종류 → 놓으면 새 트랙을 만들지 물음 (점선을 주황으로)
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const start = startAt(e.clientX, lane, e.altKey);
    if (!ghost) ghost = createClip({ ...data, start });
    ghost.classList.add('is-ghost');
    ghost.classList.toggle('is-mismatch', kind !== data.kind);
    ghost.style.setProperty('--s', start);
    if (ghost.parentElement !== lane) {
      ghost.parentElement?.classList.remove('is-drop-target');
      lane.append(ghost);
      lane.classList.add('is-drop-target');
    }
    edgeScroll(scroll, e.clientX);
  });

  lanes.addEventListener('dragleave', (e) => {
    if (!lanes.contains(e.relatedTarget)) clearGhost();
  });

  lanes.addEventListener('drop', async (e) => {
    if (!data) return;
    const item = data;
    // ① 빈 곳 → 맨 끝에 새 트랙
    if (fillTarget) {
      e.preventDefault();
      const start = startAt(e.clientX, fillLane(), e.altKey);
      clearGhost();
      const track = createTrack({ kind: item.kind, name: item.name, color: item.color });
      lanes.querySelector('#tracks').append(track);
      renumberTracks(onChange);
      onChange({ type: 'createTrack', track, kind: item.kind, trackId: track.dataset.trackId });
      placeNewClip(track, item, start);
      return;
    }
    if (!ghost) return;
    e.preventDefault();
    const lane = ghost.parentElement;
    const start = parseFloat(ghost.style.getPropertyValue('--s'));
    const mismatch = ghost.classList.contains('is-mismatch');
    clearGhost();
    if (!mismatch) { placeNewClip(lane.closest('.sq-track'), item, start); return; }
    // ③ 종류가 다른 트랙 → 물어보고, 만들면 그 트랙 바로 아래에
    const target = lane.closest('.sq-track');
    if (!(await askNewTrack(item, target))) return;
    const track = createTrack({ kind: item.kind, name: item.name, color: item.color });
    const after = target.nextElementSibling?.classList.contains('sq-acc') ? target.nextElementSibling : target;
    after.after(track);
    renumberTracks(onChange);   // 중간에 끼웠으니 아래 트랙 번호가 하나씩 밀림
    onChange({ type: 'createTrack', track, kind: item.kind, trackId: track.dataset.trackId });
    placeNewClip(track, item, start);
  });

  /** 트랙에 클립을 넣고 그 클립만 선택 */
  function placeNewClip(track, item, start) {
    const clip = createClip({ ...item, start });
    track.querySelector('.sq-track__lane').append(clip);
    clearSelection(lanes);
    clip.classList.add('is-selected');
    onChange({ type: 'create', clip, trackId: track.dataset.trackId, start, length: item.length });
  }

  document.addEventListener('dragend', () => { clearGhost(); data = null; });
}

/** 다른 종류 트랙에 놓았을 때 묻는 창 (#track-kind-ask) — 만들면 true */
function askNewTrack(item, target) {
  const dlg = document.getElementById('track-kind-ask');
  if (!dlg) return Promise.resolve(false);
  const isAudio = item.kind === 'audio';
  const targetName = target.querySelector('.sq-track__name b')?.textContent.trim() ?? 'this track';
  dlg.querySelector('[data-ask="title"]').textContent = isAudio ? 'Create a new audio track?' : 'Create a new MIDI track?';
  dlg.querySelector('[data-ask="body"]').textContent = isAudio
    ? `“${item.name}” is an audio sample, but ${targetName} is a MIDI track. A new audio track will be added below it.`
    : `“${item.name}” is a MIDI pattern, but ${targetName} is an audio track. A new MIDI track will be added below it.`;
  dlg.querySelector('[data-ask="ok"]').textContent = isAudio ? 'Create audio track' : 'Create MIDI track';
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'create'), { once: true }));
}

/**
 * 트랙 번호를 위에서부터 차례로 다시 매김 (Ableton · FL 처럼 번호 = 위치) — 그룹 트랙(번호 없음)은 건너뜀
 * 번호를 가리키는 표시도 함께 바꿈: 이름 옆 ⇠10 · →1, 펼침의 `<from Track 10>` · `Track 1 › Instruments`,
 * Connect to Another 의 트랙 번호 칸, 믹서 줄 이름, 피아노롤 트랙 이름
 * @param {(change: object) => void} [notify]  바뀐 번호가 있으면 { type: 'renumber', map: { 옛 번호: 새 번호 } }
 * @returns {Map<number, number>}
 */
export function renumberTracks(notify = () => {}) {
  const map = new Map();
  let n = 0;
  document.querySelectorAll('#tracks > .sq-track .sq-track__name b').forEach((b) => {
    const text = b.firstChild;
    const m = text?.nodeType === Node.TEXT_NODE && /^(\s*)(\d+)\./.exec(text.nodeValue);
    if (!m) return;
    n += 1;
    map.set(Number(m[2]), n);
    if (Number(m[2]) !== n) text.nodeValue = text.nodeValue.replace(/^(\s*)\d+\./, `$1${n}.`);
  });
  if ([...map].every(([a, b]) => a === b)) return map;
  const to = (d) => map.get(Number(d)) ?? d;
  // ⇠10 · →1 · Track 10 (한 번에 바꿔서 겹쳐 바뀌지 않게)
  const fixRefs = (t) => t.replace(/([⇠→])(\d+)|\bTrack (\d+)/g, (all, arrow, a, b) => (arrow ? arrow + to(a) : `Track ${to(b)}`));
  const roots = [document.getElementById('lanes'), document.getElementById('bottom')].filter(Boolean);
  for (const root of roots) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const node = w.currentNode;
      if (node.parentElement.closest('.sq-track__name b, .sq-clip, .sq-marker')) continue;   // 트랙 이름(위에서) · 클립 · 마커 이름은 그대로
      if (/[⇠→]\d|Track \d/.test(node.nodeValue)) node.nodeValue = fixRefs(node.nodeValue);
    }
    root.querySelectorAll('.sq-link[title]').forEach((el) => { el.title = fixRefs(el.title); });
  }
  // Connect to Another 의 트랙 번호 칸
  document.querySelectorAll('#lanes input[id$="-track"]').forEach((inp) => { if (inp.value) inp.value = to(inp.value); });
  // 믹서 줄 · 피아노롤 트랙 이름 "8. Vocal"
  document.querySelectorAll('.sq-strip__name, #roll-track').forEach((el) => {
    el.textContent = el.textContent.replace(/^(\d+)\./, (all, d) => `${to(d)}.`);
  });
  notify({ type: 'renumber', map: Object.fromEntries(map) });
  return map;
}

let trackSeq = 0;

/**
 * 트랙 한 줄을 지웁니다 (S1-06 FR-207 트랙 삭제) — 머리의 × 버튼이 부릅니다.
 * - 트랙 줄을 없애고 `renumberTracks()` 로 남은 번호를 다시 매깁니다
 * - MASTER 는 지우지 않습니다(맨 아래 고정 줄). 그 밖의 트랙(MIDI · 오디오 · 리턴 · 그룹)은 지웁니다
 * - 지운 뒤 `{type:'delete', trackId}` 를 알립니다(저장용). 번호정리 알림은 `renumberTracks()` 가 냅니다
 * @param {HTMLElement} track  지울 트랙 줄
 * @param {(change: object) => void} [notify]  바뀜 알림
 * @returns {string|null} 지운 트랙 id (못 지우면 null)
 */
export function deleteTrack(track, notify = () => {}) {
  if (!track || track.classList.contains('sq-track--master')) return null;
  const trackId = track.dataset.trackId;
  track.remove();
  renumberTracks(notify);
  notify({ type: 'delete', trackId });
  return trackId;
}

/** 트랙 머리에 삭제 × 버튼이 없으면 붙입니다 (이미 있으면 건너뜀). MASTER 는 빼고 */
function ensureTrackDelete(root) {
  root.querySelectorAll('.sq-track').forEach((track) => {
    if (track.classList.contains('sq-track--master')) return;
    const head = track.querySelector('.sq-track__head');
    if (!head || head.querySelector('.sq-track__del')) return;
    head.append(trackDeleteButton());
  });
}

/** 삭제 × 버튼 하나 (createTrack · addTrack · ensureTrackDelete 가 함께 씀) */
function trackDeleteButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sq-track__del';
  b.setAttribute('aria-label', 'Delete track');
  b.setAttribute('title', 'Delete track');
  b.textContent = '×';
  return b;
}

/**
 * 새 트랙 한 줄 (studioNx.html 의 트랙과 같은 모양) — 번호는 지금 가장 큰 번호 + 1
 * @param {{ kind: 'audio'|'midi', name: string, color?: string }} opt
 * @returns {HTMLLIElement}
 */
export function createTrack({ kind, name, color }) {
  const nums = [...document.querySelectorAll('#tracks .sq-track__name b')].map((b) => parseInt(b.textContent, 10)).filter(Number.isFinite);
  const num = Math.max(0, ...nums) + 1;
  const li = document.createElement('li');
  li.className = 'sq-track';
  li.dataset.trackId = `new-${++trackSeq}`;
  li.dataset.color = kind === 'audio' ? 'audio' : (color || String(((num - 1) % 5) + 1));
  const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const sub = kind === 'audio' ? `🎵 ${esc(name)}.wav` : '🎹 No instrument';
  li.innerHTML = `
            <div class="sq-track__head">
              <button type="button" class="sq-grip" aria-label="Reorder track" title="Drag to reorder">⠿</button>
              <button type="button" class="sq-power" aria-pressed="true" aria-label="Track on/off"></button>
              <button type="button" class="sq-expand" aria-expanded="false" aria-label="Open track">V</button>
              <span class="sq-track__name"><b>${num}. ${esc(name)}</b><small>${sub}</small></span>
              <span class="sq-msr"><button type="button" class="is-mute" aria-pressed="false" aria-label="Mute">M</button><button type="button" class="is-solo" aria-pressed="false" aria-label="Solo">S</button><button type="button" class="is-arm" aria-pressed="false" aria-label="Record arm">●</button></span>
              <button type="button" class="sq-track__del" aria-label="Delete track" title="Delete track">×</button>
            </div>
            <div class="sq-track__lane"></div>`;
  return li;
}

/* ───────────── 왼쪽 목록 바꾸기 (Samples ↔ Patterns) ───────────── */
// 끌어 놓을 패턴을 고르려고 필요한 만큼만. 나머지 카테고리(Presets 등)는 sequencer.js initRail 에서

function initBrowserLists() {
  const LISTS = {
    samples: { list: 'file-list', title: 'Samples', search: 'Search samples (Ctrl+F)' },
    patterns: { list: 'pattern-list', title: 'Patterns', search: 'Search patterns (Ctrl+F)' },
  };
  const title = document.getElementById('files-title');
  const count = title?.nextElementSibling;
  const search = document.getElementById('file-search');
  const filters = document.querySelector('.sq-filters');

  document.querySelector('.sq-rail')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.sq-rail__btn[data-category]');
    const conf = btn && LISTS[btn.dataset.category];
    if (!conf) return;
    document.querySelectorAll('.sq-rail__btn[data-category]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    for (const c of Object.values(LISTS)) document.getElementById(c.list).hidden = c !== conf;
    const list = document.getElementById(conf.list);
    title.textContent = conf.title;
    if (count) count.textContent = `${list.children.length} items`;
    if (search) search.placeholder = conf.search;
    if (filters) filters.hidden = conf !== LISTS.samples;
  });
}

/* ───────────── 4) 재생선 · 재생 방식 (수정 사항2) ───────────── */

/** 재생 방식: 'page' = 트랙은 그대로, 재생선이 오른쪽으로 / 'scroll' = 재생선은 그 자리, 트랙이 왼쪽으로 */
export const FOLLOW_MODES = ['page', 'scroll'];
const FOLLOW_KEY = 'studionx.sequencer.follow';   // 이 브라우저에만 기억 (정식 저장은 환경 설정 FR-2161)

let playheadCtx = null;

/** 지금 재생 방식 */
export function getFollowMode() {
  return playheadCtx?.mode ?? 'page';
}

/**
 * 재생 방식 바꾸기 — 도구 막대 버튼 · VIEW 메뉴 · 단축키가 모두 이것을 부름
 * @param {'page'|'scroll'} mode
 */
export function setFollowMode(mode) {
  if (!playheadCtx || !FOLLOW_MODES.includes(mode)) return;
  playheadCtx.mode = mode;
  playheadCtx.anchor = null;   // 트랙이 움직이는 방식은 다음 프레임의 재생선 화면 위치를 기준점으로 다시 잡음
  document.querySelectorAll('[data-follow]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.follow === mode)));
  document.querySelectorAll('[data-command="view.followPage"], [data-command="view.followScroll"]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.command === (mode === 'page' ? 'view.followPage' : 'view.followScroll')));
  });
  try { localStorage.setItem(FOLLOW_KEY, mode); } catch { /* 저장이 막힌 브라우저 — 이번 창에서만 */ }
}

/**
 * 재생선을 어느 마디에 둘지 — 소리 엔진(또는 아래 미리보기 재생)이 부름
 * - 재생 중이면 재생 방식에 따라 편곡을 스크롤
 * @param {number} bar  0 부터 (12.5 = 13마디 셋째 박)
 */
export function setPlayheadBar(bar) {
  const c = playheadCtx;
  if (!c) return;
  c.bar = clamp(bar, 0, totalBars(c.lanes));
  c.playhead.style.setProperty('--at', c.bar);
  updateTime(c.bar);
  if (c.playing) follow(c);
  if (recState) updateTakes();
}

/** 지금 재생선 위치(마디) */
export function getPlayheadBar() {
  return playheadCtx?.bar ?? 0;
}

/** 재생 중인지 */
export function isPlaying() {
  return !!playheadCtx?.playing;
}

/** 재생 시작 · 일시정지 · 멈춤 (스페이스 · 메뉴가 부름) */
export function startPlayback() { if (playheadCtx && !playheadCtx.playing) play(); }
export function pausePlayback() { if (playheadCtx?.playing) pause(); }
export function stopPlayback() { if (playheadCtx) stop(); }

/**
 * 상단 시간 표시 — 큰 글씨/작은 글씨 중 하나는 분:초:밀리초, 다른 하나는 마디.박.16분 (#time 을 누르면 서로 바뀜)
 * 4/4 · 지금 BPM 기준 (템포 · 박자 변경점은 엔진 구현 때)
 */
function updateTime(bar) {
  const main = document.getElementById('time-main');
  const small = document.getElementById('time-bars');
  if (!main || !small) return;
  const sec = (bar * 4 * 60) / currentBpm();
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(Math.floor(sec % 60)).padStart(2, '0');
  const ms = String(Math.floor((sec * 1000) % 1000)).padStart(3, '0');
  const clock = `${mm}:${ss}:${ms}`;
  const bars = `${Math.floor(bar) + 1}.${Math.floor((bar % 1) * 4) + 1}.${Math.floor(((bar * 4) % 1) * 4) + 1}`;
  const barsFirst = document.getElementById('time')?.dataset.mode === 'bars';
  main.textContent = barsFirst ? bars : clock;
  small.textContent = barsFirst ? clock : bars;
}

/** 재생 중 편곡 따라가기 */
function follow(c) {
  const head = c.scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  const x = head + c.bar * barWidth(c.lanes);          // 편곡 안에서 재생선 위치(px)
  const view = c.scroll.clientWidth;
  if (c.mode === 'page') {
    // 트랙은 그대로 — 재생선이 화면 오른쪽 끝을 넘으면 한 화면 넘김 (넘기지 않으면 재생선이 사라짐)
    const screenX = x - c.scroll.scrollLeft;
    if (screenX > view - 8 || screenX < head) c.scroll.scrollLeft = x - head - 8;
  } else {
    // 재생선은 그 자리 — 시작할 때 보이던 화면 위치(안 보이면 트랙 칸의 1/3)에 두고 트랙을 움직임
    if (c.anchor == null) {
      const screenX = x - c.scroll.scrollLeft;
      c.anchor = screenX >= head && screenX <= view - 8 ? screenX : head + (view - head) / 3;
    }
    c.scroll.scrollLeft = x - c.anchor;   // 곡 처음·끝 근처에서는 더 못 움직여 재생선이 대신 움직임
  }
}

function initPlayhead({ scroll, lanes }) {
  const playhead = document.getElementById('playhead');
  if (!playhead) return;
  playheadCtx = {
    scroll, lanes, playhead,
    bar: parseFloat(playhead.style.getPropertyValue('--at')) || 0,
    mode: 'page', anchor: null, playing: false, raf: 0, startBar: 0,
  };
  let saved = null;
  try { saved = localStorage.getItem(FOLLOW_KEY); } catch { /* 없음 */ }
  setFollowMode(FOLLOW_MODES.includes(saved) ? saved : 'page');

  // 고르기: 도구 막대 · VIEW 메뉴
  document.getElementById('follow')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-follow]');
    if (b) setFollowMode(b.dataset.follow);
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-command="view.followPage"], [data-command="view.followScroll"]');
    if (b) setFollowMode(b.dataset.command === 'view.followPage' ? 'page' : 'scroll');
  });

  // 미리보기 재생 (소리 없음): ▶ 재생/일시정지 · ■ 멈추고 시작 위치로
  document.getElementById('btn-play')?.addEventListener('click', () => (playheadCtx.playing ? pause() : play()));
  document.getElementById('btn-stop')?.addEventListener('click', stop);
}

/** 지금 BPM — 상단 #bpm 글자 (나중에는 프로젝트 BPM · 템포 변경점) */
function currentBpm() {
  return parseFloat(document.getElementById('bpm')?.textContent) || 120;
}

function play() {
  const c = playheadCtx;
  c.playing = true;
  c.startBar = c.bar;
  c.anchor = null;
  document.body.classList.add('is-playing');
  let last = performance.now();
  const tick = (now) => {
    if (!c.playing) return;
    const barsPerSec = currentBpm() / 60 / 4;          // 4/4 — 박자 변경점은 엔진 구현 때
    let next = c.bar + ((now - last) / 1000) * barsPerSec;
    // Loop 켜짐: 구간 끝을 지나면 구간 처음으로 (구간보다 뒤에서 시작했으면 그대로 진행)
    const loopEnd = loopState.start + loopState.length;
    if (loopState.on && loopState.length > 0 && c.bar < loopEnd && next >= loopEnd) next = loopState.start + ((next - loopEnd) % loopState.length);
    last = now;
    if (next >= totalBars(c.lanes)) { stop(); return; }
    setPlayheadBar(next);
    c.raf = requestAnimationFrame(tick);
  };
  c.raf = requestAnimationFrame(tick);
}

function pause() {
  const c = playheadCtx;
  c.playing = false;
  cancelAnimationFrame(c.raf);
  document.body.classList.remove('is-playing');
}

function stop() {
  const c = playheadCtx;
  const wasPlaying = c.playing;
  if (recState) stopRecording();
  pause();
  // 재생 중 ■ → 시작한 자리로, 멈춘 상태에서 ■ → 곡 처음으로
  setPlayheadBar(wasPlaying ? c.startBar : 0);
  if (!wasPlaying) c.scroll.scrollLeft = 0;
}

/* ───────────── 5) 확대 · 축소 (Ctrl+휠) · 격자 · 마커 끌기 ───────────── */

/** 확대 배율 범위 — 1 = 1마디 1.8rem(28.8px). 0.25 = 7.2px (999마디면 이때도 가로 스크롤이 남음) */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 12;

/**
 * 1마디 폭(px)에 따른 격자 단계 — 촘촘할수록 선·스냅 단위가 작아짐 ("Snap: Line" = 보이는 선에 붙음)
 * minPx 이상이면 그 단계. ruler = 줄자 숫자 간격(마디)
 */
const GRID_LEVELS = [
  { name: 'sixteenth', minPx: 160, snap: 1 / 16, ruler: 1 },
  { name: 'beat', minPx: 56, snap: 1 / 4, ruler: 1 },
  { name: 'bar', minPx: 24, snap: 1, ruler: 2 },
  { name: 'bar', minPx: 12, snap: 1, ruler: 4 },
  { name: 'bar4', minPx: 0, snap: 1, ruler: 8 },
];

let zoomCtx = null;

/** 셋잇단일 때 스냅 — 박 단계 1/12(8분 셋잇단), 1/16 단계 1/24(16분 셋잇단). 마디 단계는 그대로 1마디 */
const TRIPLET_SNAP = { beat: 1 / 12, sixteenth: 1 / 24 };

/* ── 격자 규칙 (피아노롤 sequencer-roll.js 도 같은 규칙을 씀) ── */

/** 1마디 폭(px) → 격자 단계 */
export function gridLevelFor(px) {
  return GRID_LEVELS.find((l) => px >= l.minPx);
}

/** 그 단계의 스냅 단위(마디) — 셋잇단 · Snap Off · Alt(free) 반영 */
export function snapUnitFor(level, free = false) {
  if (free || snapMode === 'off') return TICK;
  return (zoomCtx?.triplet && TRIPLET_SNAP[level.name]) || level.snap;
}

/**
 * 그 단계에서 그릴 세로선 겹 — [1마디를 몇 칸으로, 색 변수 이름] 을 잘게 → 굵게 순서로
 * (bar4 는 4마디마다 = 0.25칸)
 */
export function gridLayers(level, triplet) {
  const sub = triplet ? { beat: 12, sixteenth: 24 }[level.name] : { sixteenth: 16 }[level.name];
  const layers = [];
  if (sub) layers.push([sub, '--sq-grid']);
  if (level.name === 'beat' || level.name === 'sixteenth') layers.push([4, level.name === 'beat' && !sub ? '--sq-grid' : '--sq-line']);
  layers.push([level.name === 'bar4' ? 0.25 : 1, level.name === 'bar' || level.name === 'bar4' ? '--sq-grid' : '--sq-line-2']);
  return layers;
}

/** 셋잇단 · 스냅 설정이 바뀌었음을 알림 (피아노롤이 격자를 다시 그림) */
const notifyGridSettings = () => document.dispatchEvent(new CustomEvent('sq:grid-settings'));

/** 지금 스냅 단위 (마디) */
export function getSnap() {
  if (!zoomCtx) return SNAP;
  return (zoomCtx.triplet && TRIPLET_SNAP[zoomCtx.level.name]) || zoomCtx.level.snap;
}

/** 셋잇단 격자 켜고 끄기 — 상단 '³ Triplet' · OPTIONS › Triplet grid */
export function setTriplet(on) {
  const c = zoomCtx;
  if (!c) return;
  c.triplet = !!on;
  c.lanes.toggleAttribute('data-triplet', c.triplet);
  requestGrid();
  notifyGridSettings();
  document.getElementById('triplet')?.setAttribute('aria-pressed', String(c.triplet));
  document.querySelector('[data-command="options.triplet"]')?.setAttribute('aria-checked', String(c.triplet));
}

/** 셋잇단 켜져 있는지 */
export function isTriplet() {
  return !!zoomCtx?.triplet;
}

/** 지금 확대 배율 */
export function getZoom() {
  return zoomCtx?.zoom ?? 1;
}

/**
 * 확대 배율 바꾸기
 * @param {number} zoom      1 = 1마디 28.8px
 * @param {number} [anchorX] 이 화면 X(px, 편곡 칸 왼쪽 기준)에 있던 마디가 그 자리에 남도록 스크롤 (없으면 트랙 칸 가운데)
 */
export function setZoom(zoom, anchorX) {
  const c = zoomCtx;
  if (!c) return;
  const head = c.scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  const x = anchorX ?? head + (c.scroll.clientWidth - head) / 2;
  const oldBarWidth = barWidth(c.lanes);
  c.zoom = clampZoom(zoom, fitZoom(c));
  applyBarWidth(c);
  updateGrid(c);
  c.scroll.scrollLeft = zoomScrollLeft(c.scroll.scrollLeft, x, head, oldBarWidth, barWidth(c.lanes));
}

/**
 * 전체 보기 — 클립 · 마커가 있는 곳까지(8마디 단위로 올림, 최소 32마디)를 한 화면에 맞춤
 * (999마디 전체를 넣으면 1마디가 1px 도 안 돼서 곡이 있는 곳까지만)
 */
export function zoomToContent() {
  const c = zoomCtx;
  if (!c) return;
  let end = 0;
  c.lanes.querySelectorAll('.sq-clip:not(.is-ghost), .sq-auto').forEach((el) => {
    end = Math.max(end, (parseFloat(el.style.getPropertyValue('--s')) || 0) + (parseFloat(el.style.getPropertyValue('--l')) || 0));
  });
  c.lanes.querySelectorAll('.sq-marker').forEach((m) => { end = Math.max(end, (parseFloat(m.style.getPropertyValue('--at')) || 0) + 1); });
  const bars = Math.max(32, Math.ceil(end / 8) * 8);
  const head = c.scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.8;
  setZoom((c.scroll.clientWidth - head) / bars / base);
  c.scroll.scrollLeft = 0;
}

/** 화면을 꽉 채우는 배율 (이보다 더 축소하면 어차피 꽉 채우기 폭이 이김) */
function fitZoom(c) {
  const head = c.scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.8;
  return (c.scroll.clientWidth - head) / totalBars(c.lanes) / base;
}

/**
 * 1마디 폭을 **정수 px** 로 정해 CSS 변수에 넣음 — 소수 px 이면 선·클립 끝이 픽셀 사이에 걸려 흐려짐
 * - 확대 폭(28.8 × 배율)을 반올림, 화면이 아주 넓으면 꽉 채우는 폭(올림) 중 큰 값
 */
function applyBarWidth(c) {
  const head = c.scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.8;
  const fill = (c.scroll.clientWidth - head) / totalBars(c.lanes);
  c.lanes.style.setProperty('--sq-zoom', c.zoom);
  c.lanes.style.setProperty('--sq-bar-w', `${Math.max(1, Math.round(base * c.zoom), Math.ceil(fill))}px`);
}

/** 1마디 폭에 맞춰 격자 단계 · 줄자 숫자 다시 쓰기 */
function updateGrid(c) {
  const px = barWidth(c.lanes);
  const level = GRID_LEVELS.find((l) => px >= l.minPx);
  const rulerChanged = !c.level || c.level.ruler !== level.ruler;
  c.level = level;
  c.lanes.dataset.grid = level.name;
  c.lanes.style.setProperty('--sq-ruler-step', level.ruler);
  if (rulerChanged) renderRuler(c, level.ruler);
  requestGrid();
}

/* ── 격자 그리기 (canvas) ── */

let gridFrame = 0;

/** 다음 화면 갱신 때 격자를 한 번 그림 (스크롤 · 확대 · 크기 변화가 한꺼번에 와도 한 번만) */
function requestGrid() {
  if (gridFrame) return;
  gridFrame = requestAnimationFrame(() => { gridFrame = 0; drawGrid(); drawWaveforms(); });
}

/**
 * 보이는 부분의 격자만 그림
 * - 세로: 트랙 클립 칸(.sq-track__lane)이 있는 줄에만 (＋ Add Track 아래 빈 칸 · 펼침 · 눈금에는 안 그림)
 * - 가로: 단계별 선 — 마디(bar4 는 4마디) · 박(1/4) · 가장 잘게(1/16, 셋잇단이면 1/12 · 1/24)
 *   잘게 나눈 선부터 그리고 굵은 단위 선을 위에 덮음. 위치는 정수 px 로 반올림 → 또렷함
 */
function drawGrid() {
  const c = zoomCtx;
  const canvas = document.getElementById('grid-canvas');
  if (!c || !canvas) return;
  const { scroll, lanes } = c;
  const main = scroll.parentElement.getBoundingClientRect();
  const box = scroll.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = scroll.clientWidth;
  const h = scroll.clientHeight;
  // canvas 를 스크롤 칸(스크롤 바 제외)과 같은 자리 · 크기로
  canvas.style.top = `${box.top - main.top}px`;
  canvas.style.left = `${box.left - main.left}px`;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);

  // 세로 범위: 클립 칸들을 위아래로 붙은 것끼리 합침 (scroll 칸 기준 y)
  const bands = [];
  lanes.querySelectorAll('.sq-track__lane').forEach((lane) => {
    if (lane.closest('[hidden]')) return;
    const r = lane.getBoundingClientRect();
    const top = Math.max(0, r.top - box.top);
    const bottom = Math.min(h, r.bottom - box.top);
    if (bottom <= top) return;
    const last = bands[bands.length - 1];
    if (last && top - last.bottom <= 1) last.bottom = Math.max(last.bottom, bottom);
    else bands.push({ top, bottom });
  });
  if (!bands.length) return;

  const css = getComputedStyle(lanes);
  const color = (name) => css.getPropertyValue(name).trim();
  const head = scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
  const barW = barWidth(lanes);
  // [1마디를 몇 칸으로, 색] — 잘게 → 굵게 순서
  const layers = gridLayers(c.level, c.triplet).map(([div, name]) => [div, color(name)]);

  const x0 = scroll.scrollLeft;
  const firstBar = Math.max(0, Math.floor((x0) / barW) - 1);
  const lastBar = Math.min(totalBars(lanes), Math.ceil((x0 + w - head) / barW) + 1);
  const px = Math.max(1, Math.round(dpr));
  // Loop 구간 — 트랙 위에 옅은 보라 (선보다 먼저)
  if (loopState.on) {
    const lx = Math.max(head, head + loopState.start * barW - x0);
    const rx = Math.min(w, head + (loopState.start + loopState.length) * barW - x0);
    if (rx > lx) {
      g.fillStyle = color('--sq-accent');
      g.globalAlpha = 0.08;
      for (const b of bands) g.fillRect(Math.round(lx * dpr), Math.round(b.top * dpr), Math.round((rx - lx) * dpr), Math.round((b.bottom - b.top) * dpr));
      g.globalAlpha = 1;
    }
  }
  for (const [div, fill] of layers) {
    g.fillStyle = fill;
    const step = barW / div;
    const nFirst = Math.floor((firstBar * barW) / step);
    const nLast = Math.ceil((lastBar * barW) / step);
    for (let n = nFirst; n <= nLast; n++) {
      // 선은 칸의 오른쪽 끝 1px (예전 CSS 와 같은 자리)
      const x = head + n * step - x0 - 1;
      if (x < head - 1 || x > w) continue;
      const dx = Math.round(x * dpr);
      for (const b of bands) g.fillRect(dx, Math.round(b.top * dpr), px, Math.round((b.bottom - b.top) * dpr));
    }
  }
}

/** 줄자 숫자: step 마디마다 (1 · 1+step · …) — 루프 표시는 그대로 둠 */
function renderRuler(c, step) {
  const bars = c.lanes.querySelector('.sq-ruler__bars');
  if (!bars) return;
  bars.querySelectorAll(':scope > span').forEach((n) => n.remove());
  const frag = document.createDocumentFragment();
  for (let b = 1; b <= totalBars(c.lanes); b += step) {
    const n = document.createElement('span');
    n.style.setProperty('--bar', b);
    n.textContent = b;
    frag.append(n);
  }
  bars.prepend(frag);
}

function initZoom({ scroll, lanes }) {
  zoomCtx = { scroll, lanes, zoom: 1, level: null, triplet: false };
  applyBarWidth(zoomCtx);
  updateGrid(zoomCtx);
  // 격자 다시 그리기: 스크롤 · 트랙 높이 변화(펼침 · 접기 · 아래 칸) · 테마
  scroll.addEventListener('scroll', requestGrid, { passive: true });
  new ResizeObserver(requestGrid).observe(lanes);
  new MutationObserver(requestGrid).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.getElementById('triplet')?.addEventListener('click', () => setTriplet(!zoomCtx.triplet));
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-command="options.triplet"]')) setTriplet(!zoomCtx.triplet);
  });

  // Ctrl+휠 (노트북 터치패드 두 손가락 벌리기도 Ctrl+휠로 들어옴) — 브라우저 확대는 막음
  scroll.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);   // 휠 한 칸(100) ≈ 0.86배 / 1.16배
    setZoom(zoomCtx.zoom * factor, e.clientX - scroll.getBoundingClientRect().left);
  }, { passive: false });

  // VIEW 메뉴: 확대 · 축소 · 전체 보기
  document.addEventListener('click', (e) => {
    const cmd = e.target.closest('[data-command^="view.zoom"]')?.dataset.command;
    if (cmd === 'view.zoomIn') setZoom(zoomCtx.zoom * 1.25);
    else if (cmd === 'view.zoomOut') setZoom(zoomCtx.zoom / 1.25);
    else if (cmd === 'view.zoomFit') zoomToContent();
  });

  // 창 크기가 바뀌면 꽉 채우기 폭이 바뀌므로 격자 단계 다시
  new ResizeObserver(() => { applyBarWidth(zoomCtx); updateGrid(zoomCtx); }).observe(scroll);
}

/** 마커를 끌어 좌우로 옮김 — 스냅은 클립과 같음 */
function initMarkerDrag({ scroll, lanes, onChange }) {
  const track = lanes.querySelector('.sq-markers__track');
  if (!track) return;
  let drag = null;

  track.addEventListener('pointerdown', (e) => {
    const marker = e.target.closest('.sq-marker');
    if (!marker || e.button !== 0) return;
    drag = { marker, id: e.pointerId, x: e.clientX, scrollLeft: scroll.scrollLeft, at: parseFloat(marker.style.getPropertyValue('--at')) || 0, moved: false };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.marker.setPointerCapture(e.pointerId);
      drag.marker.classList.add('is-dragging');
    }
    const dx = e.clientX - drag.x + (scroll.scrollLeft - drag.scrollLeft);
    drag.marker.style.setProperty('--at', clamp(snap(drag.at + dx / barWidth(lanes), e.altKey), 0, totalBars(lanes)));
    edgeScroll(scroll, e.clientX);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { marker, moved } = drag;
    if (moved) {
      marker.releasePointerCapture(e.pointerId);
      marker.classList.remove('is-dragging');
      const at = parseFloat(marker.style.getPropertyValue('--at'));
      if (at !== drag.at) onChange({ type: 'marker', marker, start: at });
      // 끈 뒤의 click(마커로 이동)은 무시
      marker.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
    } else {
      // 클릭 = 이 마커 선택 + 재생선을 마커로
      selectMarker(marker);
      setPlayheadBar(parseFloat(marker.style.getPropertyValue('--at')) || 0);
    }
    drag = null;
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
}

/* ───────────── 7) 도구 · 영역 선택 · 스냅 메뉴 · Loop ───────────── */

/** 도구 막대에서 고른 도구 — 'draw' · 'paint' · 'delete' · 'mute' · 'slip' · 'slice' · 'select' · 'zoom' */
let currentTool = 'draw';

/** 도구별 힌트 바 문구 (나머지 도구 동작은 sequencer.js 구현 때) */
const TOOL_HINTS = {
  draw: '<b>Draw (P)</b> — Left-click to add the selected clip · Select and press Delete to remove',
  paint: '<b>Paint (B)</b> — Drag across a track to paint copies of the selected clip',
  delete: '<b>Delete (D)</b> — Click or drag over clips to delete them',
  mute: '<b>Mute (T)</b> — Click a clip to mute or unmute it',
  slip: '<b>Slip (S)</b> — Drag inside a clip to slide its content',
  slice: '<b>Slice (C)</b> — Click a clip to cut it in two at that point',
  select: '<b>Select (E)</b> — Drag on empty space to select clips · Ctrl+drag adds to the selection',
  zoom: '<b>Zoom</b> — Click to zoom in · Alt+click or right-click to zoom out',
};

/** 지금 도구 */
export function getTool() {
  return currentTool;
}

/**
 * 도구 바꾸기 — 도구 막대 버튼(data-tool) · 단축키 P/B/D/T/S/C/E 가 부름
 * @param {string} tool
 */
export function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.sq-tools [data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
  document.body.classList.toggle('is-tool-select', tool === 'select');
  document.body.className = document.body.className.replace(/\btool-\w+/g, '').trim();   // 도구별 커서
  document.body.classList.add(`tool-${tool}`);
  const hint = document.getElementById('hint');
  const btn = document.querySelector(`.sq-tools [data-tool="${tool}"]`);
  if (hint) hint.innerHTML = TOOL_HINTS[tool] ?? `<b>${btn?.title ?? tool}</b>`;
}

function initTools() {
  document.querySelector('.sq-tools')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b) setTool(b.dataset.tool);
  });
  // 단축키 (FR-2249) — 입력칸 밖, 수식키 없이. A = 오토메이션(sequencer-automation.js), Z = 전체 보기
  const KEYS = { p: 'draw', b: 'paint', d: 'delete', t: 'mute', s: 'slip', c: 'slice', e: 'select' };
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (KEYS[k]) { setTool(KEYS[k]); e.preventDefault(); }
    else if (k === 'z') { zoomToContent(); e.preventDefault(); }
  });
}

/** Select(E) 도구 — 트랙 빈 곳을 끌면 사각형 안(조금이라도 걸친) 클립을 선택. Ctrl 을 누르고 끌면 지금 선택에 더함 */
function initMarquee({ scroll, lanes }) {
  let m = null;
  const local = (x, y) => { const r = lanes.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };

  lanes.addEventListener('pointerdown', (e) => {
    if (currentTool !== 'select' || e.button !== 0) return;
    if (!e.target.closest('.sq-track__lane, .sq-fill__lane') || e.target.closest('.sq-clip, .sq-auto, button')) return;
    const add = e.ctrlKey || e.metaKey;
    m = {
      id: e.pointerId, add, moved: false, el: null,
      start: local(e.clientX, e.clientY), x: e.clientX, y: e.clientY,
      base: new Set(add ? lanes.querySelectorAll('.sq-clip.is-selected') : []),
    };
  });

  lanes.addEventListener('pointermove', (e) => {
    if (!m || e.pointerId !== m.id) return;
    if (!m.moved && Math.hypot(e.clientX - m.x, e.clientY - m.y) < DRAG_THRESHOLD) return;
    if (!m.moved) {
      m.moved = true;
      lanes.setPointerCapture(e.pointerId);
      m.el = document.createElement('div');
      m.el.className = 'sq-marquee';
      lanes.append(m.el);
    }
    edgeScroll(scroll, e.clientX);
    const cur = local(e.clientX, e.clientY);
    const box = { left: Math.min(m.start.x, cur.x), top: Math.min(m.start.y, cur.y), right: Math.max(m.start.x, cur.x), bottom: Math.max(m.start.y, cur.y) };
    Object.assign(m.el.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.right - box.left}px`, height: `${box.bottom - box.top}px` });
    const r0 = lanes.getBoundingClientRect();
    lanes.querySelectorAll('.sq-clip:not(.is-ghost)').forEach((clip) => {
      if (!clip.offsetParent) return;   // 접힌 그룹 · 숨은 줄
      const r = clip.getBoundingClientRect();
      const hit = r.right - r0.left > box.left && r.left - r0.left < box.right && r.bottom - r0.top > box.top && r.top - r0.top < box.bottom;
      clip.classList.toggle('is-selected', hit || m.base.has(clip));
    });
  });

  const end = (e) => {
    if (!m || e.pointerId !== m.id) return;
    if (m.moved) {
      lanes.releasePointerCapture(e.pointerId);
      m.el.remove();
    } else if (!m.add) {
      clearSelection(lanes);   // 빈 곳을 그냥 클릭 → 선택 풀기
    }
    m = null;
  };
  lanes.addEventListener('pointerup', end);
  lanes.addEventListener('pointercancel', end);
}

/** 스냅 방식 바꾸기 — 'line' | 'off' */
export function setSnapMode(mode) {
  snapMode = mode === 'off' ? 'off' : 'line';
  updateSnapButton();
  refreshSnapMenu();
  notifyGridSettings();
}

/** 지금 스냅 방식 */
export function getSnapMode() {
  return snapMode;
}

/** 스냅 버튼 글자 — 방식에 맞춰 다시 씁니다 (고른 분할은 'Snap: 1/16T ▾', 자동은 'Snap: Line ▾') */
function updateSnapButton() {
  const btn = document.getElementById('snap');
  if (!btn) return;
  if (snapMode === 'off') btn.textContent = 'Snap: Off ▾';
  else if (snapMode === 'division') btn.textContent = `Snap: ${snapDivision}${snapTriplet ? 'T' : ''} ▾`;
  else btn.textContent = 'Snap: Line ▾';
}

/** 스냅 메뉴 체크 표시 — 지금 방식에 맞춰 aria-checked 를 다시 씁니다 */
function refreshSnapMenu() {
  const menu = document.getElementById('menu-snap');
  if (!menu) return;
  menu.querySelectorAll('[data-snap]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.snap === snapMode)));
  menu.querySelectorAll('[data-division]').forEach((b) => {
    const on = snapMode === 'division' && b.dataset.division === snapDivision && (b.dataset.triplet === 'true') === snapTriplet;
    b.setAttribute('aria-checked', String(on));
  });
}

/** 스냅 메뉴에 분할 목록(1/1~1/32 · 셋잇단)을 만듭니다 — `snapOptions()` 목록 그대로 */
function buildSnapDivisions(menu) {
  if (menu.querySelector('[data-division]')) return;
  const note = menu.querySelector('#snap-note');
  const frag = document.createDocumentFragment();
  for (const opt of snapOptions()) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', 'false');
    b.dataset.division = opt.division;
    b.dataset.triplet = String(opt.triplet);
    b.textContent = opt.label;
    li.appendChild(b);
    frag.appendChild(li);
  }
  if (note) menu.insertBefore(frag, note);
  else menu.appendChild(frag);
}

function initSnapMenu() {
  const btn = document.getElementById('snap');
  const menu = document.getElementById('menu-snap');
  if (!btn || !menu) return;
  buildSnapDivisions(menu);
  updateSnapButton();
  refreshSnapMenu();
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => {
    if (!menu.hidden) { close(); return; }
    const top = btn.closest('.sq-top').getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    menu.style.left = `${r.left - top.left}px`;
    menu.style.top = `${r.bottom - top.top + 2}px`;
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-snap],[data-division]');
    if (!item) return;
    if (item.dataset.division) setSnapDivision(item.dataset.division, item.dataset.triplet === 'true');
    else setSnapMode(item.dataset.snap);
    close();
  });
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/** Loop 구간 (마디) — on 이면 미리보기 재생이 구간 안에서 반복 */
const loopState = { on: false, start: 0, length: 4 };

/** 지금 Loop */
export function getLoop() {
  return { ...loopState };
}

/**
 * Loop 바꾸기 — 마디 줄 위 띠(#loop) · Loop 버튼 · 트랙 위 옅은 보라를 함께
 * @param {{ start?: number, length?: number, on?: boolean }} next
 */
export function setLoop(next) {
  Object.assign(loopState, next);
  const el = document.getElementById('loop');
  if (el) {
    el.style.setProperty('--s', loopState.start);
    el.style.setProperty('--l', loopState.length);
    el.classList.toggle('is-off', !loopState.on);
  }
  document.getElementById('btn-loop')?.setAttribute('aria-pressed', String(loopState.on));
  requestGrid();
}

/** 마커 줄에서 마우스 오른쪽 버튼을 누른 채 끌면 Loop 구간 · ⟲ 버튼으로 켜고 끄기 */
function initLoop({ scroll, lanes, onChange }) {
  const el = document.getElementById('loop');
  if (el) setLoop({ start: parseFloat(el.style.getPropertyValue('--s')) || 0, length: parseFloat(el.style.getPropertyValue('--l')) || 4, on: !el.classList.contains('is-off') });

  document.getElementById('btn-loop')?.addEventListener('click', () => {
    setLoop({ on: !loopState.on });
    onChange({ type: 'loop', ...getLoop() });
  });

  const row = lanes.querySelector('.sq-markers__track');
  if (!row) return;
  row.addEventListener('contextmenu', (e) => e.preventDefault());   // 오른쪽 버튼은 Loop 그리기에 씀
  let d = null;
  const barAt = (x) => (x - row.getBoundingClientRect().left) / barWidth(lanes);

  row.addEventListener('pointerdown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault();
    d = { id: e.pointerId, x: e.clientX, anchor: clamp(snap(barAt(e.clientX), e.altKey), 0, totalBars(lanes)), moved: false, onMarker: !!e.target.closest('.sq-marker') };
    row.setPointerCapture(e.pointerId);
    row.classList.add('is-looping');
  });
  row.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < DRAG_THRESHOLD) return;
    d.moved = true;
    const cur = clamp(snap(barAt(e.clientX), e.altKey), 0, totalBars(lanes));
    const unit = snapUnit(e.altKey);
    let start = Math.min(d.anchor, cur);
    let end = Math.max(d.anchor, cur);
    if (end - start < unit) end = Math.min(totalBars(lanes), start + unit);   // 최소 한 칸
    setLoop({ start, length: round(end - start), on: true });
    edgeScroll(scroll, e.clientX);
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    row.releasePointerCapture(e.pointerId);
    row.classList.remove('is-looping');
    if (d.moved) onChange({ type: 'loop', ...getLoop() });
    else if (!d.onMarker) addMarker(d.anchor, { edit: true });   // 빈 곳 오른쪽 클릭 = 마커 추가 (끌면 Loop)
    d = null;
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
}

/* ───────────── 8) 트랙 높이 ───────────── */

/** 트랙 높이 범위(px) · 기본 · ↕−/↕+ 단계 */
const TRACK_H_MIN = 28;
const TRACK_H_MAX = 200;
const TRACK_H_STEPS = [28, 36, 44, 56, 72, 96, 128, 160, 200];
/** 이보다 낮으면 악기 이름 줄을 숨김 */
const TRACK_H_COMPACT = 38;

let heightCtx = null;

/** 기본(전체) 트랙 높이 px — CSS 의 --sq-row-h (2.75rem = 44px) 를 잼 */
function baseTrackHeight(lanes) {
  const v = getComputedStyle(lanes).getPropertyValue('--sq-row-h').trim();
  if (v.endsWith('px')) return parseFloat(v);
  return parseFloat(v) * parseFloat(getComputedStyle(document.documentElement).fontSize);   // rem
}

/** 높이에 맞춰 낮은 트랙 표시 (.is-compact) */
function markCompact(track) {
  track.classList.toggle('is-compact', track.getBoundingClientRect().height < TRACK_H_COMPACT);
}

/**
 * 한 트랙 높이 바꾸기 (null = 기본 높이로)
 * @param {HTMLElement} track  .sq-track
 * @param {number|null} px
 */
export function setTrackHeight(track, px) {
  if (px == null) track.style.removeProperty('--sq-row-h');
  else track.style.setProperty('--sq-row-h', `${Math.round(clamp(px, TRACK_H_MIN, TRACK_H_MAX))}px`);
  markCompact(track);
}

/**
 * 전체 트랙 높이 바꾸기 — 트랙마다 따로 정한 높이는 지우고 모두 같은 높이로 (Ableton 의 Alt+끌기와 같음)
 * @param {number} px
 */
export function setAllTrackHeights(px) {
  const c = heightCtx;
  if (!c) return;
  c.lanes.style.setProperty('--sq-row-h', `${Math.round(clamp(px, TRACK_H_MIN, TRACK_H_MAX))}px`);
  c.lanes.querySelectorAll('.sq-track').forEach((t) => { t.style.removeProperty('--sq-row-h'); markCompact(t); });
}

/** 전체 높이를 한 단계 크게(+1) · 작게(-1) */
function stepAllTrackHeights(dir) {
  const next = stepTrackHeight(baseTrackHeight(heightCtx.lanes), dir);
  if (next != null) setAllTrackHeights(next);
  return next;
}

function initTrackHeight({ lanes, onChange }) {
  heightCtx = { lanes, defaultH: baseTrackHeight(lanes) };
  let r = null;

  // 손잡이 = 트랙의 ::after (아래 경계 6px). 거기를 누르면 event.target 이 트랙 자신
  const handleOf = (e) => (e.target.classList?.contains('sq-track') ? e.target : null);

  lanes.addEventListener('pointerdown', (e) => {
    const track = handleOf(e);
    if (!track || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    r = { track, id: e.pointerId, y: e.clientY, h: track.getBoundingClientRect().height, all: e.altKey };
    lanes.setPointerCapture(e.pointerId);
    lanes.classList.add('is-resizing');
    track.classList.add('is-resizing');
  });
  lanes.addEventListener('pointermove', (e) => {
    if (!r || e.pointerId !== r.id) return;
    const px = r.h + (e.clientY - r.y);
    if (r.all) setAllTrackHeights(px);
    else setTrackHeight(r.track, px);
  });
  const end = (e) => {
    if (!r || e.pointerId !== r.id) return;
    lanes.releasePointerCapture(e.pointerId);
    lanes.classList.remove('is-resizing');
    r.track.classList.remove('is-resizing');
    const height = Math.round(r.track.getBoundingClientRect().height);
    if (height !== Math.round(r.h)) onChange(r.all ? { type: 'trackHeight', all: true, height } : { type: 'trackHeight', trackId: r.track.dataset.trackId, height });
    r = null;
  };
  lanes.addEventListener('pointerup', end);
  lanes.addEventListener('pointercancel', end);

  // 경계 더블 클릭 → 그 트랙은 기본(전체) 높이로
  // (끌기 때 포인터를 lanes 에 붙잡아서 dblclick 의 target 이 lanes 가 됨 → 위치로 트랙을 찾음)
  lanes.addEventListener('dblclick', (e) => {
    const track = handleOf(e) || [...lanes.querySelectorAll('.sq-track')].find((t) => Math.abs(t.getBoundingClientRect().bottom - e.clientY) <= 4);
    if (!track) return;
    setTrackHeight(track, null);
    onChange({ type: 'trackHeight', trackId: track.dataset.trackId, height: Math.round(track.getBoundingClientRect().height) });
  });

  // ↕− / ↕+ · VIEW 메뉴
  const step = (dir) => {
    const h = stepAllTrackHeights(dir);
    if (h != null) onChange({ type: 'trackHeight', all: true, height: h });
  };
  document.querySelector('.sq-heightctl')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-height]');
    if (b) step(Number(b.dataset.height));
  });
  document.addEventListener('click', (e) => {
    const cmd = e.target.closest('[data-command^="view.tracks"]')?.dataset.command;
    if (cmd === 'view.tracksTaller') step(1);
    else if (cmd === 'view.tracksShorter') step(-1);
    else if (cmd === 'view.tracksReset') { setAllTrackHeights(heightCtx.defaultH); onChange({ type: 'trackHeight', all: true, height: heightCtx.defaultH }); }
  });

  lanes.querySelectorAll('.sq-track').forEach(markCompact);
}

/* ───────────── 지우기 키 (2026-10-06) ─────────────
   선택한 것을 Delete · Backspace 로 지움. 마지막으로 누른 곳(편곡 / 피아노롤)의 선택만 — body[data-focus-area] */

/** 지우기 키인지 (입력칸에서 글자를 지울 때는 제외) */
export function isDeleteKey(e) {
  return (e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !e.altKey
    && !e.target.closest?.('input, textarea, select, [contenteditable]');
}

/** 마지막으로 누른 곳 — 'arrange' | 'roll' */
export function focusArea() {
  return document.body.dataset.focusArea || 'arrange';
}

/** 선택한 클립 지우기 — 지운 수를 돌려줌 */
export function deleteSelectedClips() {
  const lanes = document.getElementById('lanes');
  const sel = [...lanes.querySelectorAll('.sq-clip.is-selected:not(.is-ghost)')];
  sel.forEach((clip) => {
    const trackId = clip.closest('.sq-track')?.dataset.trackId;
    const start = parseFloat(clip.style.getPropertyValue('--s'));
    const length = parseFloat(clip.style.getPropertyValue('--l'));
    clip.remove();
    arrangeOnChange({ type: 'delete', clip, trackId, start, length });
  });
  return sel.length;
}

let arrangeOnChange = () => {};

function initDeleteClips({ scroll, onChange }) {
  arrangeOnChange = onChange;
  // 마지막으로 누른 곳 기억 (편곡 칸 · 피아노롤)
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#panel-roll')) document.body.dataset.focusArea = 'roll';
    else if (e.target.closest('#arrange')) document.body.dataset.focusArea = 'arrange';
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!isDeleteKey(e) || focusArea() !== 'arrange' || document.body.classList.contains('is-automation')) return;
    const n = deleteSelectedClips() + deleteSelectedMarker();
    if (n) e.preventDefault();
  });
  // EDIT › Delete
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-command="edit.delete"]') && focusArea() === 'arrange') deleteSelectedClips();
  });
}

/* ───────────── 알림 (짧은 안내 상자) ───────────── */

/** 화면 아래 가운데에 잠깐 뜨는 안내 — 아직 서버 · 소리 엔진이 없어 안 되는 것을 알릴 때 */
export function showToast(text, ms = 2600) {
  let box = document.getElementById('sq-toast');
  if (!box) {
    box = document.createElement('div');
    box.id = 'sq-toast';
    box.className = 'sq-toast';
    box.setAttribute('role', 'status');
    document.body.append(box);
  }
  box.textContent = text;
  box.classList.add('is-on');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => box.classList.remove('is-on'), ms);
}

/* ───────────── 11) 도구 동작 ───────────── */

/** 트랙 위에서 좌우 이동 대신 자기 동작을 하는 도구 */
const TOOL_ACTS = new Set(['paint', 'delete', 'mute', 'slip', 'slice', 'zoom']);

/** Draw · Paint 로 놓을 것 { kind, name, length } — 마지막으로 누른 클립 · 목록 항목 · Pattern ▾ */
let drawTemplate = { kind: 'midi', name: 'Bass #2', length: 6 };

/** 클립 → 놓을 것 */
function templateOf(clip) {
  return {
    kind: clip.classList.contains('sq-clip--audio') ? 'audio' : 'midi',
    name: clip.querySelector('.sq-clip__name').textContent.replace(/^[▤⇥]\s*/, '').trim(),
    length: parseFloat(clip.style.getPropertyValue('--l')) || 1,
    // 서버 번호를 이어받아 복제 · 가르기 · 새로 그리기가 같은 패턴/샘플을 가리키게 (S1-10a)
    patternId: clip.dataset.patternId || null,
    sampleId: clip.dataset.sampleId || null,
  };
}

/** Draw · Paint 로 놓을 것 바꾸기 — MIDI 면 상단 'Pattern: … ▾' 글자도 */
export function setDrawTemplate(t) {
  drawTemplate = { ...t };
  if (t.kind === 'midi') {
    const chip = document.getElementById('pattern-select');
    if (chip) chip.textContent = `Pattern: ${t.name} ▾`;
  }
}

export function getDrawTemplate() {
  return { ...drawTemplate };
}

/** 이 트랙에 놓을 것 — 종류가 다르면 그 트랙의 첫 클립을 본뜸 (없으면 놓지 않음) */
function templateFor(lane) {
  const kind = laneKind(lane);
  if (!kind) return null;
  if (drawTemplate.kind === kind) return drawTemplate;
  const first = lane.querySelector('.sq-clip:not(.is-ghost)');
  return first ? templateOf(first) : null;
}

/** Draw: 클릭한 자리(왼쪽 격자선)에 클립 놓기 — 놓았으면 true */
function drawClipAt(lane, clientX, free) {
  const t = templateFor(lane);
  if (!t) return false;
  const lanes = document.getElementById('lanes');
  const bar = (clientX - lane.getBoundingClientRect().left) / barWidth(lanes);
  const start = clamp(floorSnap(bar, free), 0, totalBars(lanes) - t.length);
  const clip = createClip({ ...t, start });
  lane.append(clip);
  clearSelection(lanes);
  clip.classList.add('is-selected');
  arrangeOnChange({ type: 'create', clip, trackId: lane.closest('.sq-track').dataset.trackId, start, length: t.length });
  return true;
}

function initToolActions({ scroll, lanes, onChange }) {
  let act = null;
  const clipAt = (x, y) => document.elementsFromPoint(x, y).map((el) => el.closest?.('.sq-clip:not(.is-ghost)')).find(Boolean);
  const barIn = (lane, x) => (x - lane.getBoundingClientRect().left) / barWidth(lanes);

  lanes.addEventListener('contextmenu', (e) => { if (currentTool === 'zoom' && e.target.closest('.sq-track__lane, .sq-fill__lane')) e.preventDefault(); });

  lanes.addEventListener('pointerdown', (e) => {
    if (!TOOL_ACTS.has(currentTool) || document.body.classList.contains('is-automation')) return;
    const lane = e.target.closest('.sq-track__lane');
    const area = lane || e.target.closest('.sq-fill__lane');
    if (!area) return;
    const clip = e.target.closest('.sq-clip:not(.is-ghost)');
    // Zoom: 왼쪽 클릭 = 확대, Alt+클릭 · 오른쪽 클릭 = 축소 (누른 곳 기준)
    if (currentTool === 'zoom') {
      if (e.button !== 0 && e.button !== 2) return;
      const out = e.button === 2 || e.altKey;
      setZoom(getZoom() * (out ? 1 / 1.5 : 1.5), e.clientX - scroll.getBoundingClientRect().left);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    act = { tool: currentTool, id: e.pointerId, lane, x: e.clientX, done: new Set(), moved: false, sl: scroll.scrollLeft };
    lanes.setPointerCapture(e.pointerId);
    if (act.tool === 'delete') deleteClip(clip, act);
    else if (act.tool === 'mute') muteClip(clip, act);
    else if (act.tool === 'slice' && clip) sliceClip(clip, barIn(clip.parentElement, e.clientX), e.altKey);
    else if (act.tool === 'slip' && clip) act.slip = { clip, o: parseFloat(clip.style.getPropertyValue('--o')) || 0 };
    else if (act.tool === 'paint' && lane) {
      const t = templateFor(lane);
      if (!t) { act = null; return; }
      act.t = t;
      act.start0 = clamp(floorSnap(barIn(lane, e.clientX), e.altKey), 0, totalBars(lanes) - t.length);
      paintAt(act, 0);
    }
  });

  lanes.addEventListener('pointermove', (e) => {
    if (!act || e.pointerId !== act.id) return;
    act.moved = true;
    if (act.tool === 'delete') deleteClip(clipAt(e.clientX, e.clientY), act);
    else if (act.tool === 'mute') muteClip(clipAt(e.clientX, e.clientY), act);
    else if (act.tool === 'slip' && act.slip) {
      // 내용만 밀기 — 클립 길이 안에서 (−길이 ~ +길이)
      const c = act.slip.clip;
      const len = parseFloat(c.style.getPropertyValue('--l')) || 1;
      const dBar = (e.clientX - act.x + (scroll.scrollLeft - act.sl)) / barWidth(lanes);
      c.style.setProperty('--o', round(clamp(act.slip.o + snap(dBar, e.altKey), -len, len)));
    } else if (act.tool === 'paint' && act.t) {
      // 처음 칸부터 포인터까지 클립 길이 간격으로 칠하기 (왼쪽으로 끌어도 됨)
      const k = Math.floor((barIn(act.lane, e.clientX) - act.start0) / act.t.length);
      const step = k >= 0 ? 1 : -1;
      for (let i = 0; i !== k + step; i += step) paintAt(act, i);
    }
    edgeScroll(scroll, e.clientX);
  });

  const end = (e) => {
    if (!act || e.pointerId !== act.id) return;
    lanes.releasePointerCapture(e.pointerId);
    if (act.tool === 'slip' && act.slip) {
      const c = act.slip.clip;
      const o = parseFloat(c.style.getPropertyValue('--o')) || 0;
      if (o !== act.slip.o) onChange({ type: 'slip', clip: c, trackId: c.closest('.sq-track').dataset.trackId, offset: o });
    }
    act = null;
  };
  lanes.addEventListener('pointerup', end);
  lanes.addEventListener('pointercancel', end);

  function deleteClip(clip, a) {
    if (!clip || a.done.has(clip)) return;
    a.done.add(clip);
    const info = { trackId: clip.closest('.sq-track')?.dataset.trackId, start: parseFloat(clip.style.getPropertyValue('--s')), length: parseFloat(clip.style.getPropertyValue('--l')) };
    clip.remove();
    onChange({ type: 'delete', clip, ...info });
  }
  function muteClip(clip, a) {
    if (!clip || a.done.has(clip)) return;
    a.done.add(clip);
    clip.classList.toggle('is-muted');
    onChange({ type: 'muteClip', clip, trackId: clip.closest('.sq-track').dataset.trackId, muted: clip.classList.contains('is-muted') });
  }
  function paintAt(a, i) {
    const start = round(a.start0 + i * a.t.length);
    if (start < 0 || start + a.t.length > totalBars(lanes) || a.done.has(start)) return;
    // 이미 같은 자리에 시작하는 클립이 있으면 건너뜀
    if ([...a.lane.querySelectorAll('.sq-clip:not(.is-ghost)')].some((c) => Math.abs((parseFloat(c.style.getPropertyValue('--s')) || 0) - start) < 1e-6)) { a.done.add(start); return; }
    a.done.add(start);
    const clip = createClip({ ...a.t, start });
    a.lane.append(clip);
    onChange({ type: 'create', clip, trackId: a.lane.closest('.sq-track').dataset.trackId, start, length: a.t.length });
  }
  /** Slice: 누른 자리(격자)에서 둘로 — 두 토막이 각각 한 칸 이상일 때만 가름 (S1-06 FR-208) */
  function sliceClip(clip, bar, free) {
    const s = parseFloat(clip.style.getPropertyValue('--s')) || 0;
    const l = parseFloat(clip.style.getPropertyValue('--l')) || 1;
    const offset = parseFloat(clip.style.getPropertyValue('--o')) || 0;
    const stepTicks = barsToTicks(snapUnit(free));   // Alt = 격자 무시(1틱)
    // 오디오는 원본 처음(start − offset)을 넘겨야 오른쪽 토막 오프셋이 이어짐. MIDI 는 null
    const source = clip.classList.contains('sq-clip--audio') ? barsToTicks(s) - barsToTicks(offset) : null;
    const at = snap(bar, free);
    const res = splitClip(barsToTicks(s), barsToTicks(l), barsToTicks(at), stepTicks, source);
    if (!res) return;
    clip.style.setProperty('--s', round(ticksToBars(res.left.start)));
    clip.style.setProperty('--l', round(ticksToBars(res.left.length)));
    clip.style.setProperty('--o', round(ticksToBars(res.left.offset)));
    const right = createClip({ ...templateOf(clip), start: round(ticksToBars(res.right.start)), length: round(ticksToBars(res.right.length)) });
    right.style.setProperty('--o', round(ticksToBars(res.right.offset)));
    if (clip.classList.contains('is-muted')) right.classList.add('is-muted');
    clip.after(right);
    onChange({ type: 'slice', clip, right, trackId: clip.closest('.sq-track').dataset.trackId, at: round(ticksToBars(res.right.start)), offset: round(ticksToBars(res.right.offset)) });
  }
}

/* ───────────── 12) 트랙 머리 버튼 · ＋ Add Track ───────────── */

/** 솔로가 하나라도 있으면 솔로 아닌 트랙(리턴 · MASTER 제외)을 흐리게 */
function applySolo(lanes) {
  const soloed = [...lanes.querySelectorAll('.sq-track .is-solo[aria-pressed="true"]')].map((b) => b.closest('.sq-track'));
  lanes.querySelectorAll('.sq-track').forEach((t) => {
    const dim = soloed.length > 0 && !soloed.includes(t) && !t.matches('.sq-track--return, .sq-track--master')
      && !soloed.some((g) => g.matches('.sq-track--group') && t.dataset.parent === g.dataset.trackId);
    t.classList.toggle('is-solo-dimmed', dim);
  });
}

/** 같은 트랙의 믹서 줄 버튼(data-track-id)도 같은 상태로 */
function syncStrip(trackId, cls, on) {
  document.querySelectorAll(`.sq-strip[data-track-id="${trackId}"] .${cls}`).forEach((b) => b.setAttribute('aria-pressed', String(on)));
}

let accSeq = 0;

/** 펼침 칸이 없는 트랙이면 2번 트랙 펼침을 본떠 새로 만들어 붙임 */
function ensureAccordion(track) {
  const btn = track.querySelector('.sq-expand');
  const id = btn?.getAttribute('aria-controls');
  if (id && document.getElementById(id)) return document.getElementById(id);
  const src = document.getElementById('acc-2');
  if (!src) return null;
  const acc = src.cloneNode(true);
  const n = `x${++accSeq}`;
  acc.id = `acc-${n}`;
  acc.hidden = true;
  acc.querySelectorAll('[id]').forEach((el) => { el.id = el.id.replace(/^conn-2/, `conn-${n}`); });
  acc.querySelectorAll('label[for]').forEach((el) => { el.htmlFor = el.htmlFor.replace(/^conn-2/, `conn-${n}`); });
  const name = track.querySelector('.sq-track__name b')?.textContent.replace(/^\d+\.\s*/, '').trim() ?? '';
  const sub = track.querySelector('.sq-track__name small')?.textContent.replace(/^[^\w<]*/, '').trim() ?? '';
  const isAudio = track.dataset.color === 'audio' || track.matches('.sq-track--return, .sq-track--master');
  const inst = acc.querySelector('.sq-inst');
  acc.querySelector('.sq-midifx')?.remove();
  if (inst) {
    inst.querySelector('.sq-inst__name').textContent = isAudio ? name : `${name} → ${sub || 'No instrument'}`;
    inst.querySelector('small').textContent = isAudio ? sub : 'Preset: —';
  }
  if (isAudio) {
    const h3 = acc.querySelector('[aria-label="Instrument"] h3');
    if (h3) h3.innerHTML = 'AUDIO <span class="sq-badge">WAV</span>';
    inst?.querySelector('.sq-knobs')?.remove();
    const drop = inst?.querySelector('.sq-inst__drop');
    if (drop) drop.textContent = 'Click the clip to open sample settings';
  }
  // 이펙트는 비운 채 ＋ 만
  const chain = acc.querySelector('.sq-chain');
  if (chain) [...chain.children].forEach((li) => { if (!li.querySelector('.sq-fx-add')) li.remove(); });
  track.after(acc);
  btn?.setAttribute('aria-controls', acc.id);
  return acc;
}

/** V — 그 트랙 펼침 열고 닫기 (기본은 하나만, Shift 면 여러 개) */
export function toggleTrackPanel(track, keepOthers = false) {
  const btn = track.querySelector('.sq-expand');
  const acc = ensureAccordion(track);
  if (!btn || !acc) return;
  const open = acc.hidden;
  if (open && !keepOthers) {
    document.querySelectorAll('.sq-acc:not([hidden])').forEach((a) => {
      a.hidden = true;
      const t = a.previousElementSibling;
      t?.classList.remove('is-open');
      t?.querySelector('.sq-expand')?.setAttribute('aria-expanded', 'false');
    });
  }
  acc.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  track.classList.toggle('is-open', open);
  saveOpenPanels();
}

/** 펼쳐 둔 트랙 번호를 담아 두는 곳 (FR-261 펼침 상태 기억, 2026-10-17) */
const PANEL_KEY = 'sq-open-tracks';

/** 지금 펼쳐진 트랙 번호를 localStorage 에 담는다 (창을 닫았다 열어도 그대로) */
function saveOpenPanels() {
  try {
    const ids = [...document.querySelectorAll('#tracks > .sq-track.is-open')]
      .map((t) => t.dataset.trackId)
      .filter(Boolean);
    localStorage.setItem(PANEL_KEY, JSON.stringify(ids));
  } catch { /* 저장 못 하는 환경은 그냥 넘어감 */ }
}

/** 담아 둔 펼침 상태를 되살린다 — 트랙을 그린 뒤(sequencer.js init)에 부른다 (FR-261) */
export function restoreOpenPanels() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(PANEL_KEY) || '[]'); } catch { ids = []; }
  if (!Array.isArray(ids) || !ids.length) return;
  for (const id of ids) {
    const track = document.querySelector(`#tracks > .sq-track[data-track-id="${id}"]`);
    if (track && !track.classList.contains('is-open')) toggleTrackPanel(track, true);
  }
}

/** 그룹 ▾ — 안쪽 트랙(data-parent)과 그 펼침을 접고 펴기 */
export function toggleGroup(group) {
  const btn = group.querySelector('.sq-fold');
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  document.querySelectorAll(`.sq-track[data-parent="${group.dataset.trackId}"]`).forEach((t) => {
    t.hidden = !open;
    const acc = t.nextElementSibling;
    if (!open && acc?.classList.contains('sq-acc')) acc.hidden = true;
  });
}

/** ＋ Add Track — MIDI · Audio 는 트랙 목록 끝, Return 은 MASTER 바로 위 */
export function addTrack(type) {
  const lanes = document.getElementById('lanes');
  if (type === 'RETURN') {
    const n = lanes.querySelectorAll('.sq-track--return').length;
    const letter = String.fromCharCode(65 + n);
    const div = document.createElement('div');
    div.className = 'sq-track sq-track--return';
    div.dataset.trackId = `r${letter.toLowerCase()}${++trackSeq}`;
    div.innerHTML = `
          <div class="sq-track__head">
            <button type="button" class="sq-grip" aria-label="Reorder track" title="Drag to reorder">⠿</button>
            <button type="button" class="sq-power" aria-pressed="true" aria-label="Track on/off"></button>
            <button type="button" class="sq-expand" aria-expanded="false" aria-label="Open return track">V</button>
            <span class="sq-track__name"><b>${letter} Return <span class="sq-badge is-return">RETURN</span></b><small>No effect</small></span>
            <span class="sq-msr"><button type="button" class="is-mute" aria-pressed="false" aria-label="Mute">M</button><button type="button" class="is-solo" aria-pressed="false" aria-label="Solo">S</button></span>
            <button type="button" class="sq-track__del" aria-label="Delete track" title="Delete track">×</button>
          </div>
          <div class="sq-track__lane"><span class="sq-track__note">Receives sends from 0 tracks</span></div>`;
    lanes.querySelector('.sq-track--master').before(div);
    arrangeOnChange({ type: 'createTrack', track: div, kind: 'return', trackId: div.dataset.trackId });
    return div;
  }
  const kind = type === 'AUDIO' ? 'audio' : 'midi';
  const track = createTrack({ kind, name: kind === 'audio' ? 'Audio' : 'MIDI' });
  if (kind === 'audio') track.querySelector('.sq-track__name small').textContent = '🎵 No sample';
  lanes.querySelector('#tracks').append(track);
  renumberTracks(arrangeOnChange);
  arrangeOnChange({ type: 'createTrack', track, kind, trackId: track.dataset.trackId });
  return track;
}

/** 트랙 순서 드래그 (S1-06 FR-207) — 머리의 ⠿ 그립을 위아래로 끌어 순서를 바꿈 */
function initTrackReorder({ lanes, onChange }) {
  const tracksEl = lanes.querySelector('#tracks');
  if (!tracksEl) return;
  let drag = null;
  const items = () => Array.from(tracksEl.children).filter((el) => el.classList.contains('sq-track'));
  const clearMarks = () => items().forEach((el) => el.classList.remove('is-reorder-target'));

  const onMove = (e) => {
    if (!drag) return;
    const list = items();
    let at = 0;
    for (const el of list) { const r = el.getBoundingClientRect(); if (e.clientY > r.top + r.height / 2) at += 1; }
    const to = Math.max(0, Math.min(list.length - 1, drag.from < at ? at - 1 : at));
    drag.to = to;
    clearMarks();
    const target = list[to];
    if (target && target !== drag.track) target.classList.add('is-reorder-target');
  };
  const cleanup = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
  };
  const onUp = () => end(true);
  const onCancel = () => end(false);

  function end(commit) {
    if (!drag) return;
    const d = drag;
    drag = null;
    cleanup();
    d.track.classList.remove('is-reorder-dragging');
    clearMarks();
    if (!commit) return;
    const list = items();
    const next = reorderItems(list, d.from, d.to);
    let changed = false;
    for (let i = 0; i < next.length; i++) { if (next[i] !== list[i]) { changed = true; break; } }
    if (!changed) return;
    next.forEach((el) => tracksEl.append(el));
    renumberTracks(onChange);
    onChange({ type: 'reorder', trackId: d.track.dataset.trackId, from: d.from, to: d.to });
  }

  lanes.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.sq-grip');
    if (!grip || e.button !== 0) return;
    const track = grip.closest('.sq-track');
    if (!track || !tracksEl.contains(track)) return;
    e.preventDefault();
    const list = items();
    drag = { track, from: list.indexOf(track), to: list.indexOf(track) };
    track.classList.add('is-reorder-dragging');
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  });
}

/* ───────────── 트랙 선택 · 그룹 (FR-207 그룹 · FR-2210) ───────────── */

let groupSeq = 0;
let trackAnchor = null;   // Shift 범위 선택의 기준 트랙

/** #tracks 안의 트랙 줄 (그룹 · MASTER 포함) */
function trackItems() {
  const container = document.getElementById('tracks');
  return container ? [...container.children].filter((el) => el.classList.contains('sq-track')) : [];
}

/** 지금 선택된 트랙 줄 (MASTER 는 빼고) */
export function selectedTracks() {
  return trackItems().filter((t) => t.classList.contains('is-selected') && !t.classList.contains('sq-track--master'));
}

/** 트랙 선택 풀기 */
export function clearTrackSelection() {
  trackItems().forEach((t) => t.classList.remove('is-selected'));
  trackAnchor = null;
}

/**
 * 트랙 한 줄 선택 — 머리의 빈 곳을 클릭할 때 부릅니다.
 * 그냥 클릭 = 이것만 · Ctrl/Cmd = 더하고 빼기 · Shift = 기준 트랙에서 여기까지 모두
 * @param {HTMLElement} track  클릭한 트랙 줄
 * @param {{ ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean }} [e]
 */
export function selectTrack(track, e = {}) {
  if (!track || track.classList.contains('sq-track--master')) return;
  const list = trackItems();
  const multi = e.ctrlKey || e.metaKey;
  if (e.shiftKey && trackAnchor && list.includes(trackAnchor)) {
    const a = list.indexOf(trackAnchor);
    const b = list.indexOf(track);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    list.forEach((t, i) => t.classList.toggle('is-selected', i >= lo && i <= hi && !t.classList.contains('sq-track--master')));
  } else if (multi) {
    track.classList.toggle('is-selected');
    trackAnchor = track;
  } else {
    list.forEach((t) => t.classList.toggle('is-selected', t === track));
    trackAnchor = track;
  }
}

/** 그룹 트랙 한 줄을 만듭니다 (이름은 "Group N") — ADD › Group track 과 선택 그룹화가 함께 씁니다 */
function createGroupEl() {
  const li = document.createElement('li');
  li.className = 'sq-track sq-track--group';
  li.dataset.trackId = `grp-${++groupSeq}`;
  li.innerHTML = `
            <div class="sq-track__head">
              <button type="button" class="sq-grip" aria-label="Reorder track" title="Drag to reorder">⠿</button>
              <button type="button" class="sq-power" aria-pressed="true" aria-label="Track on/off"></button>
              <button type="button" class="sq-fold" aria-expanded="true" aria-label="Collapse group">▾</button>
              <span class="sq-track__name"><b>Group ${groupSeq} <span class="sq-badge is-group">GROUP</span></b><small>0 tracks</small></span>
              <span class="sq-msr"><button type="button" class="is-mute" aria-pressed="false" aria-label="Mute">M</button><button type="button" class="is-solo" aria-pressed="false" aria-label="Solo">S</button></span>
              <button type="button" class="sq-track__del" aria-label="Delete track" title="Delete track">×</button>
            </div>
            <div class="sq-track__lane"><span class="sq-track__note">No tracks</span></div>`;
  return li;
}

/** 그룹 머리의 "N tracks" 글자를 지금 안쪽 트랙 수에 맞춤 */
function updateGroupCount(group) {
  const n = document.querySelectorAll(`#tracks > .sq-track[data-parent="${group.dataset.trackId}"]`).length;
  const small = group.querySelector('.sq-track__name small');
  if (small) small.textContent = `${n} track${n === 1 ? '' : 's'}`;
}

/** 빈 그룹 트랙 하나를 트랙 목록 끝(리턴 · MASTER 위)에 넣습니다 */
export function addGroup(notify = arrangeOnChange) {
  const container = document.getElementById('tracks');
  if (!container) return null;
  const group = createGroupEl();
  const before = container.querySelector('.sq-track--return, .sq-track--master');
  if (before) before.before(group);
  else container.append(group);
  notify({ type: 'createTrack', track: group, kind: 'group', trackId: group.dataset.trackId });
  return group;
}

/**
 * 선택한 트랙들을 새 그룹으로 묶습니다 (Ctrl+G · 오른쪽 클릭 메뉴).
 * 첫 선택 트랙 자리에 그룹 줄을 놓고 그 아래로 옮기며 data-parent · is-child 를 붙입니다.
 * 선택이 없으면 빈 그룹을 하나 만듭니다 (ADD › Group track 과 같게).
 * @returns {HTMLElement|null} 만든 그룹 줄
 */
export function groupSelectedTracks(notify = arrangeOnChange) {
  const sel = selectedTracks();
  if (!sel.length) return addGroup(notify);
  const group = createGroupEl();
  sel[0].before(group);
  [...sel].reverse().forEach((t) => {
    const acc = t.nextElementSibling;   // 펼침 칸은 트랙 바로 뒤에 붙어 있어 함께 옮김
    const withAcc = acc && acc.classList.contains('sq-acc') ? acc : null;
    group.after(t);   // 역순으로 넣어 원래 위에서 아래 차례를 지킴
    if (withAcc) t.after(withAcc);
    t.dataset.parent = group.dataset.trackId;
    t.classList.add('is-child');
  });
  clearTrackSelection();
  group.classList.add('is-selected');
  trackAnchor = group;
  updateGroupCount(group);
  notify({ type: 'group', trackId: group.dataset.trackId, children: sel.map((t) => t.dataset.trackId) });
  return group;
}

/** 선택한 그룹들을 풀어 안쪽 트랙을 다시 밖으로 냅니다 (오른쪽 클릭 메뉴) */
export function ungroupTracks(notify = arrangeOnChange) {
  const groups = selectedTracks().filter((t) => t.classList.contains('sq-track--group'));
  if (!groups.length) return 0;
  groups.forEach((g) => {
    document.querySelectorAll(`#tracks > .sq-track[data-parent="${g.dataset.trackId}"]`).forEach((t) => {
      delete t.dataset.parent;
      t.classList.remove('is-child');
    });
    g.remove();
  });
  notify({ type: 'ungroup', trackIds: groups.map((g) => g.dataset.trackId) });
  return groups.length;
}

/** 선택한 트랙들을 지웁니다 (오른쪽 클릭 메뉴 · Delete) — 그룹을 지우면 안쪽 트랙은 다시 밖으로 내놓습니다 */
export function deleteSelectedTracks(notify = arrangeOnChange) {
  selectedTracks().forEach((t) => {
    if (t.classList.contains('sq-track--group')) {
      document.querySelectorAll(`#tracks > .sq-track[data-parent="${t.dataset.trackId}"]`).forEach((c) => {
        delete c.dataset.parent;
        c.classList.remove('is-child');
      });
    }
    deleteTrack(t, notify);
  });
}

function initTrackButtons({ lanes, onChange }) {
  lanes.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    const track = e.target.closest('.sq-track');
    // 머리의 빈 곳(버튼 아님) 클릭 = 트랙 선택 (Ctrl · Cmd = 여러 개, Shift = 사이 모두)
    if (track && e.target.closest('.sq-track__head') && !b) { selectTrack(track, e); return; }
    if (!b || !track || !b.closest('.sq-track__head')) return;
    const id = track.dataset.trackId;
    if (b.matches('.sq-track__del')) { deleteTrack(track, onChange); return; }
    if (b.matches('.sq-power, .is-mute, .is-solo, .is-arm')) {
      const on = b.getAttribute('aria-pressed') !== 'true';
      if (b.matches('.is-solo') && (e.ctrlKey || e.metaKey)) {
        // Ctrl+S 클릭 = 이 트랙만 솔로
        lanes.querySelectorAll('.sq-track .is-solo[aria-pressed="true"]').forEach((x) => { x.setAttribute('aria-pressed', 'false'); syncStrip(x.closest('.sq-track').dataset.trackId, 'is-solo', false); });
        b.setAttribute('aria-pressed', 'true');
      } else {
        b.setAttribute('aria-pressed', String(on));
      }
      const pressed = b.getAttribute('aria-pressed') === 'true';
      if (b.matches('.sq-power')) track.classList.toggle('is-off', !pressed);
      if (b.matches('.is-mute')) { track.classList.toggle('is-muted', pressed); syncStrip(id, 'is-mute', pressed); }
      if (b.matches('.is-solo')) { syncStrip(id, 'is-solo', pressed); applySolo(lanes); }
      if (b.matches('.is-arm')) syncStrip(id, 'is-arm', pressed);
      const what = b.matches('.sq-power') ? 'power' : b.matches('.is-mute') ? 'mute' : b.matches('.is-solo') ? 'solo' : 'arm';
      onChange({ type: 'trackState', trackId: id, what, on: pressed });
    } else if (b.matches('.sq-expand')) {
      toggleTrackPanel(track, e.shiftKey);
    } else if (b.matches('.sq-fold')) {
      toggleGroup(track);
    }
  });

  // 믹서 줄 M · S · ● → 트랙 버튼과 같게
  document.getElementById('panel-mixer')?.addEventListener('click', (e) => {
    const b = e.target.closest('.sq-strip .sq-msr button');
    if (!b) return;
    const strip = b.closest('.sq-strip');
    const cls = ['is-mute', 'is-solo', 'is-arm'].find((c) => b.classList.contains(c));
    const tid = strip.dataset.trackId;
    const trackBtn = tid && lanes.querySelector(`.sq-track[data-track-id="${tid}"] .sq-track__head .${cls}`);
    if (trackBtn) trackBtn.click();
    else b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  });

  // ＋ Add Track — 칩 MIDI · Audio · Return, 버튼 자체는 MIDI
  document.getElementById('add-track')?.addEventListener('click', (e) => {
    const chip = e.target.closest('span i');
    const type = chip ? { MIDI: 'MIDI', Audio: 'AUDIO', Return: 'RETURN' }[chip.dataset.type ?? chip.textContent.trim()] ?? 'MIDI' : 'MIDI';
    addTrack(type);
  });
  // 이미 눌린 상태로 들어 있는 것 반영
  lanes.querySelectorAll('.sq-track').forEach((t) => {
    if (t.querySelector('.sq-track__head .sq-power[aria-pressed="false"]')) t.classList.add('is-off');
    if (t.querySelector('.sq-track__head .is-mute[aria-pressed="true"]')) t.classList.add('is-muted');
  });
  ensureTrackDelete(lanes);
  applySolo(lanes);
}

/* ───────────── 13) 마커 · 녹음 ───────────── */

const MARKER_COLORS = ['#7fe0a8', '#c9b8ff', '#ff8a8a', '#9fd3ff', '#ffcf5c', '#f4f3f7'];
let markerSeq = 0;

function selectMarker(m) {
  document.querySelectorAll('.sq-marker.is-selected').forEach((x) => x.classList.remove('is-selected'));
  m?.classList.add('is-selected');
}

/**
 * 마커 추가 — at(마디) 자리에, 이름은 'Marker N', 색은 차례로
 * @param {number} at
 * @param {{ name?: string, edit?: boolean }} [opt]  edit = 바로 이름 바꾸기
 */
export function addMarker(at, { name, edit = false } = {}) {
  const track = document.querySelector('.sq-markers__track');
  if (!track) return null;
  const n = track.querySelectorAll('.sq-marker').length;
  const m = document.createElement('button');
  m.type = 'button';
  m.className = 'sq-marker';
  m.style.setProperty('--at', round(at));
  m.style.setProperty('--mc', MARKER_COLORS[n % MARKER_COLORS.length]);
  m.textContent = name ?? `Marker ${++markerSeq}`;
  track.append(m);
  selectMarker(m);
  arrangeOnChange({ type: 'markerAdd', marker: m, start: round(at), name: m.textContent });
  if (edit) renameMarker(m);
  return m;
}

/** 마커 이름 바꾸기 — 마커 위에 입력칸을 띄움, Enter · 바깥 클릭 = 확정, Esc = 취소 */
function renameMarker(m) {
  const before = m.textContent;
  const input = document.createElement('input');
  input.className = 'sq-marker-input';
  input.value = before;
  input.style.setProperty('--at', m.style.getPropertyValue('--at'));
  input.setAttribute('aria-label', 'Marker name');
  m.classList.add('is-editing');
  m.after(input);
  input.focus();
  input.select();
  let closed = false;
  const done = (ok) => {
    if (closed) return;
    closed = true;
    const name = input.value.trim();
    input.remove();
    m.classList.remove('is-editing');
    if (ok && name && name !== before) {
      m.textContent = name;
      arrangeOnChange({ type: 'markerRename', marker: m, name });
    }
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();   // 이름 입력 중에는 단축키 · 지우기 키가 동작하지 않게
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    else if (e.key === 'Escape') { e.preventDefault(); done(false); }
  });
  input.addEventListener('blur', () => done(true));
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
}

/** 선택한 마커 지우기 — 지운 수 */
function deleteSelectedMarker() {
  const m = document.querySelector('.sq-marker.is-selected:not(.is-editing)');
  if (!m) return 0;
  const start = parseFloat(m.style.getPropertyValue('--at')) || 0;
  m.remove();
  arrangeOnChange({ type: 'markerDelete', marker: m, start });
  return 1;
}

function initMarkers({ lanes }) {
  const corner = lanes.querySelector('.sq-markers .sq-corner');
  const sorted = () => [...lanes.querySelectorAll('.sq-marker')].map((m) => parseFloat(m.style.getPropertyValue('--at')) || 0).sort((a, b) => a - b);
  const reveal = (bar) => {
    const scroll = document.getElementById('arrange');
    const head = scroll.querySelector('.sq-track__head')?.getBoundingClientRect().width ?? 0;
    const x = head + bar * barWidth(lanes) - scroll.scrollLeft;
    if (x < head || x > scroll.clientWidth - 20) scroll.scrollLeft = bar * barWidth(lanes) - 40;
  };
  corner?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const now = getPlayheadBar();
    const label = b.getAttribute('aria-label') ?? '';
    if (label.startsWith('Add')) {
      addMarker(snap(now), { edit: true });
    } else {
      const list = sorted();
      const next = label.startsWith('Next') ? list.find((a) => a > now + 1e-6) : [...list].reverse().find((a) => a < now - 1e-6);
      if (next != null) { setPlayheadBar(next); reveal(next); selectMarker([...lanes.querySelectorAll('.sq-marker')].find((m) => Math.abs((parseFloat(m.style.getPropertyValue('--at')) || 0) - next) < 1e-6)); }
    }
  });
  // 더블 클릭 = 이름 바꾸기
  lanes.addEventListener('dblclick', (e) => {
    const m = e.target.closest('.sq-marker');
    if (m) renameMarker(m);
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-command="marker.add"]')) addMarker(snap(getPlayheadBar()), { edit: true }); });
}

/** 녹음 상태 — 녹음 대기(●) 트랙마다 빨간 띠를 재생선까지 늘림 (소리 입력은 엔진 연결 후) */
let recState = null;

function updateTakes() {
  const end = getPlayheadBar();
  recState.takes.forEach((el) => el.style.setProperty('--l', Math.max(0.02, round(end - recState.start))));
}

function startRecording() {
  const lanes = document.getElementById('lanes');
  const armed = [...lanes.querySelectorAll('.sq-track .is-arm[aria-pressed="true"]')].map((b) => b.closest('.sq-track'));
  recState = { start: getPlayheadBar(), takes: [] };
  armed.forEach((t) => {
    const el = document.createElement('span');
    el.className = 'sq-rec-take';
    el.style.setProperty('--s', recState.start);
    el.style.setProperty('--l', 0.02);
    el.textContent = '● REC';
    t.querySelector('.sq-track__lane').append(el);
    recState.takes.push(el);
  });
  document.body.classList.add('is-recording');
  document.getElementById('btn-rec')?.setAttribute('aria-pressed', 'true');
  if (!armed.length) showToast('No track is armed — press ● on a track first');
  startPlayback();
}

function stopRecording() {
  if (!recState) return;
  recState.takes.forEach((el) => el.remove());
  const had = recState.takes.length;
  recState = null;
  document.body.classList.remove('is-recording');
  document.getElementById('btn-rec')?.setAttribute('aria-pressed', 'false');
  if (had) showToast('Recording needs the audio engine — the take was not saved yet');
}

function initRecord() {
  document.getElementById('btn-rec')?.addEventListener('click', () => (recState ? (stopRecording(), pausePlayback()) : startRecording()));
}
