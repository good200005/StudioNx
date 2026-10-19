// 레벨 미터 (S1-11a, PRD 02 FR-251)
// 소리의 크기(피크)를 좌우 채널로 읽어 화면 막대의 높이(0~100%)로 바꿉니다.
// 크기 계산(피크 → dB → 퍼센트)은 소리를 쓰지 않는 순수 함수로 두어 Node 에서도 시험합니다.
// 읽는 쪽(LevelTap)은 AnalyserNode 로 소리 흐름을 엿볼 뿐 소리를 바꾸지 않습니다.

/** 막대가 가장 낮은 값(dB). 이보다 작으면 0% */
export const METER_FLOOR_DB = -60;

/**
 * 샘플 배열의 피크(절댓값의 최댓값) (순수 함수)
 * @param {Float32Array|number[]} samples
 * @returns {number}
 */
export function peakOf(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

/**
 * 피크(0~1)를 막대 높이(%)로 바꿈 (순수 함수)
 * - dB 로 바꾼 뒤 -60dB 를 0%, 0dB 를 100% 로 두는 직선 눈금입니다 (소리 크기는 로그로 들리기 때문)
 * @param {number} peak
 * @returns {number} 0~100
 */
export function peakToPercent(peak) {
  if (!(peak > 0)) return 0;
  const db = 20 * Math.log10(peak);
  return Math.max(0, Math.min(100, (db - METER_FLOOR_DB) / -METER_FLOOR_DB * 100));
}

/**
 * 막대의 다음 값 (순수 함수) — 올라갈 때는 바로, 내려갈 때는 천천히
 * @param {number} prev  지금 막대 높이(%)
 * @param {number} now   방금 읽은 높이(%)
 * @param {number} fall  한 번에 내려가는 최대 양(%)
 * @returns {number}
 */
export function meterStep(prev, now, fall) {
  return now >= prev ? now : Math.max(now, prev - fall);
}

/**
 * 노드의 소리 크기를 좌우로 읽는 도구
 */
export class LevelTap {
  /**
   * @param {BaseAudioContext} context
   * @param {AudioNode} source  크기를 읽을 노드 (연결만 하고 소리는 바꾸지 않음)
   */
  constructor(context, source) {
    this.splitter = context.createChannelSplitter(2);
    this.left = context.createAnalyser();
    this.right = context.createAnalyser();
    this.left.fftSize = 1024;
    this.right.fftSize = 1024;
    this.left.smoothingTimeConstant = 0;
    this.right.smoothingTimeConstant = 0;
    this.bufL = new Float32Array(this.left.fftSize);
    this.bufR = new Float32Array(this.right.fftSize);
    source.connect(this.splitter);
    this.splitter.connect(this.left, 0);
    this.splitter.connect(this.right, 1);
  }

  /** 지금 크기를 읽음 → [왼쪽%, 오른쪽%] */
  read() {
    this.left.getFloatTimeDomainData(this.bufL);
    this.right.getFloatTimeDomainData(this.bufR);
    return [peakToPercent(peakOf(this.bufL)), peakToPercent(peakOf(this.bufR))];
  }
}
