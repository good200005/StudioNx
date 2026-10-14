// 오디오 엔진의 시간 계산 (S1-05, PRD 02 FR-205)
// 시간 단위는 tick 이고 1박(4분음표) = 960 tick (PPQ). BPM 은 1분에 4분음표가 몇 번인지.
// 소리를 내는 코드(AudioContext)와 따로 두어서, 계산만 따로 시험할 수 있음 (DOM 도 쓰지 않음)

/** 1박 = 960 tick (DB.md, sequencer.js 의 PPQ 와 같음) */
export const PPQ = 960;

/**
 * tick → 초 (템포가 하나일 때)
 * - 초 = tick × 60 ÷ (bpm × PPQ)  예: 120 BPM 에서 960 tick(1박) = 0.5 초
 * - 곡 중간에 템포가 바뀌는 경우(FR-202a)는 이 함수를 구간마다 불러 더하는 다음 함수에서 다룸
 * - tick 이 음수여도 계산함 (카운트인처럼 0 보다 앞의 시간을 쓸 수 있음)
 * - bpm 이 숫자가 아니거나 0 이하이면 계산할 수 없어서 오류를 던짐 (조용히 NaN 이나 Infinity 를 돌려주면
 *   스케줄러가 엉뚱한 시각에 소리를 내므로 바로 알리는 쪽이 안전함)
 * (구현: AI — 2026-10-13, S1-05, 함수 하나씩 검토)
 * @param {number} tick
 * @param {number} bpm  20~300 (FR-202), 여기서는 0 보다 큰 유한한 수면 받음
 * @returns {number} 초
 */
export function ticksToSeconds(tick, bpm) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  if (typeof bpm !== 'number' || !isFinite(bpm) || bpm <= 0) throw new RangeError('bpm 은 0 보다 큰 숫자여야 합니다: ' + bpm);
  return (tick * 60) / (bpm * PPQ);
}

/**
 * tick → 초 (곡 중간 템포 변경을 반영, FR-202a)
 * - projects.bpm 은 tick 0 의 시작 템포이고, changes 는 그 뒤의 변경점(tempo_changes)임
 * - STEP 은 변경점 위치에서 바로 바뀌고, LINEAR 는 바로 앞 변경점 위치부터 이 변경점까지 서서히 바뀜
 * - 변경점 사이는 초를 차례로 더해 나감 (스케줄러가 앞에서 뒤로 차례로 부름)
 * - tick 이 음수면(카운트인) 시작 템포 하나로 계산함
 * - LINEAR 구간의 초는 bpm 을 tick 에 대해 적분한 값이라 로그가 들어감:
 *   초 = 60/PPQ × span/(bpmEnd-bpmStart) × ln(bpm(t)/bpmStart)
 * @param {number} tick
 * @param {number} baseBpm  시작 BPM (tick 0, 20~300)
 * @param {Array<{tick:number, bpm:number, ramp:string}>} changes  tick 오름차순이 아니어도 이 함수가 정렬함
 * @returns {number} 초
 */
export function ticksToSecondsWithChanges(tick, baseBpm, changes) {
  if (typeof tick !== 'number' || !isFinite(tick)) throw new RangeError('tick 은 유한한 숫자여야 합니다: ' + tick);
  if (typeof baseBpm !== 'number' || !isFinite(baseBpm) || baseBpm <= 0) throw new RangeError('baseBpm 은 0 보다 큰 숫자여야 합니다: ' + baseBpm);

  const list = [];
  if (changes != null) {
    if (!Array.isArray(changes)) throw new RangeError('changes 는 배열이어야 합니다: ' + changes);
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      if (c == null) continue;
      if (typeof c.tick !== 'number' || !isFinite(c.tick) || c.tick <= 0) throw new RangeError('변경점 tick 은 0 보다 큰 유한한 숫자여야 합니다: ' + c.tick);
      if (typeof c.bpm !== 'number' || !isFinite(c.bpm) || c.bpm <= 0) throw new RangeError('변경점 bpm 은 0 보다 큰 숫자여야 합니다: ' + c.bpm);
      list.push({ tick: c.tick, bpm: c.bpm, ramp: c.ramp === 'LINEAR' ? 'LINEAR' : 'STEP' });
    }
    list.sort(function (a, b) { return a.tick - b.tick; });
  }

  if (tick <= 0) return (tick * 60) / (baseBpm * PPQ);

  let seconds = 0;
  let prevTick = 0;
  let bpm = baseBpm;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.tick <= prevTick) continue;
    const segEnd = tick < c.tick ? tick : c.tick;
    if (c.ramp === 'LINEAR' && c.bpm !== bpm) {
      const span = c.tick - prevTick;
      const slope = (c.bpm - bpm) / span;
      const bpmAtEnd = bpm + slope * (segEnd - prevTick);
      seconds += (60 / PPQ) * (1 / slope) * Math.log(bpmAtEnd / bpm);
    } else {
      seconds += ((segEnd - prevTick) * 60) / (bpm * PPQ);
    }
    prevTick = c.tick;
    bpm = c.bpm;
    if (tick <= c.tick) return seconds;
  }
  seconds += ((tick - prevTick) * 60) / (bpm * PPQ);
  return seconds;
}

/**
 * 초 → tick (곡 중간 템포 변경을 반영, FR-202a) — `ticksToSecondsWithChanges` 의 역함수
 * - 재생 중 위치(초)를 tick 으로 되돌릴 때, 루프 끝을 tick 으로 잡을 때 씀
 * - 구간을 차례로 지나가며 남은 초가 그 구간 안에 들어오면 그 구간에서 tick 을 풀어 냄
 * - LINEAR 구간은 bpm(t) = bpmStart + slope×(t-prevTick) 를 로그의 역(지수)으로 풀어 냄:
 *   t = prevTick + (bpmStart × e^(초×PPQ×slope/60) - bpmStart) / slope
 * - 초가 음수면(카운트인) 시작 템포 하나로 계산함
 * @param {number} seconds
 * @param {number} baseBpm  시작 BPM (tick 0, 20~300)
 * @param {Array<{tick:number, bpm:number, ramp:string}>} changes  tick 오름차순이 아니어도 이 함수가 정렬함
 * @returns {number} tick (소수점이 나올 수 있음 — 반올림은 부르는 쪽에서)
 */
export function secondsToTicks(seconds, baseBpm, changes) {
  if (typeof seconds !== 'number' || !isFinite(seconds)) throw new RangeError('seconds 는 유한한 숫자여야 합니다: ' + seconds);
  if (typeof baseBpm !== 'number' || !isFinite(baseBpm) || baseBpm <= 0) throw new RangeError('baseBpm 은 0 보다 큰 숫자여야 합니다: ' + baseBpm);

  const list = [];
  if (changes != null) {
    if (!Array.isArray(changes)) throw new RangeError('changes 는 배열이어야 합니다: ' + changes);
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      if (c == null) continue;
      if (typeof c.tick !== 'number' || !isFinite(c.tick) || c.tick <= 0) throw new RangeError('변경점 tick 은 0 보다 큰 유한한 숫자여야 합니다: ' + c.tick);
      if (typeof c.bpm !== 'number' || !isFinite(c.bpm) || c.bpm <= 0) throw new RangeError('변경점 bpm 은 0 보다 큰 숫자여야 합니다: ' + c.bpm);
      list.push({ tick: c.tick, bpm: c.bpm, ramp: c.ramp === 'LINEAR' ? 'LINEAR' : 'STEP' });
    }
    list.sort(function (a, b) { return a.tick - b.tick; });
  }

  if (seconds <= 0) return (seconds * baseBpm * PPQ) / 60;

  let rest = seconds;
  let prevTick = 0;
  let bpm = baseBpm;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.tick <= prevTick) continue;
    const span = c.tick - prevTick;
    const isLinear = c.ramp === 'LINEAR' && c.bpm !== bpm;
    const slope = isLinear ? (c.bpm - bpm) / span : 0;
    const segSeconds = isLinear
      ? (60 / PPQ) * (1 / slope) * Math.log(c.bpm / bpm)
      : (span * 60) / (bpm * PPQ);

    if (rest >= segSeconds) {
      rest -= segSeconds;
      prevTick = c.tick;
      bpm = c.bpm;
      continue;
    }
    if (isLinear) {
      const bpmAt = bpm * Math.exp((rest * PPQ * slope) / 60);
      return prevTick + (bpmAt - bpm) / slope;
    }
    return prevTick + (rest * bpm * PPQ) / 60;
  }
  return prevTick + (rest * bpm * PPQ) / 60;
}
