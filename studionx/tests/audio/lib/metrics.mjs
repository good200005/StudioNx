// 오디오 회귀 테스트의 비교 지표 (S1-12, PRD 00 §7.1)
// 두 렌더링 결과(채널별 Float32Array)가 같은 소리인지를 세 숫자로 판정합니다.
//   1) 샘플 단위 차이의 최댓값  2) 차이 신호의 RMS(dBFS)  3) 통합 라우드니스(LUFS) 차이
// 브라우저가 필요 없는 순수 계산이라 Node 에서 바로 시험합니다.

/** 기본 허용 오차. 프로젝트 JSON 의 tolerance 로 덮어쓸 수 있음 */
export const DEFAULT_TOLERANCE = {
  maxDiff: 1e-3,    // 샘플 하나의 최대 차이 (-60 dBFS)
  rmsDb: -80,       // 차이 신호의 RMS (dBFS). PRD 예시값
  lufs: 0.05,       // 통합 라우드니스 차이 (LU). 음량이 0.05dB 만 달라져도 잡음
  minPeak: 1e-3,    // 렌더링 결과의 최소 피크 (소리가 아예 안 나는 일을 잡음)
};

/** 20·log10, 0 이하는 -Infinity */
export function toDb(x) {
  return x > 0 ? 20 * Math.log10(x) : -Infinity;
}

/** 채널 전체의 피크 */
export function peakOf(channels) {
  let p = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) { const v = Math.abs(ch[i]); if (v > p) p = v; }
  return p;
}

/**
 * 두 결과의 차이 지표
 * @param {Float32Array[]} a  현재 렌더링
 * @param {Float32Array[]} b  골든
 * @returns {{maxDiff:number, rmsDiffDb:number}}
 */
export function diffMetrics(a, b) {
  let maxDiff = 0, sumSq = 0, n = 0;
  for (let c = 0; c < a.length; c++) {
    const x = a[c], y = b[c];
    for (let i = 0; i < x.length; i++) {
      const d = x[i] - y[i];
      const ad = Math.abs(d);
      if (ad > maxDiff) maxDiff = ad;
      sumSq += d * d;
      n += 1;
    }
  }
  return { maxDiff: maxDiff, rmsDiffDb: toDb(Math.sqrt(sumSq / Math.max(1, n))) };
}

/** K 가중 필터 계수 (ITU-R BS.1770, 샘플레이트에 맞춰 계산) → 두 단계 biquad */
function kWeightingStages(fs) {
  // 1단계: 높은 음을 올리는 셸빙 필터 (머리 주변의 음향 효과)
  const f1 = 1681.974450955533, g1 = 3.999843853973347, q1 = 0.7071752369554196;
  let k = Math.tan(Math.PI * f1 / fs);
  const vh = Math.pow(10, g1 / 20);
  const vb = Math.pow(vh, 0.4996667741545416);
  let a0 = 1 + k / q1 + k * k;
  const s1 = {
    b: [(vh + vb * k / q1 + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q1 + k * k) / a0],
    a: [2 * (k * k - 1) / a0, (1 - k / q1 + k * k) / a0],
  };
  // 2단계: 낮은 음을 깎는 하이패스 필터
  const f2 = 38.13547087602444, q2 = 0.5003270373238773;
  k = Math.tan(Math.PI * f2 / fs);
  a0 = 1 + k / q2 + k * k;
  const s2 = { b: [1 / a0, -2 / a0, 1 / a0], a: [2 * (k * k - 1) / a0, (1 - k / q2 + k * k) / a0] };
  return [s1, s2];
}

/** biquad 한 단계 (직접형 II 전치) */
function biquad(x, st) {
  const y = new Float64Array(x.length);
  let z1 = 0, z2 = 0;
  const b0 = st.b[0], b1 = st.b[1], b2 = st.b[2], a1 = st.a[0], a2 = st.a[1];
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const o = b0 * v + z1;
    z1 = b1 * v - a1 * o + z2;
    z2 = b2 * v - a2 * o;
    y[i] = o;
  }
  return y;
}

/**
 * 통합 라우드니스 (LUFS, ITU-R BS.1770-4)
 * - 400ms 블록, 75% 겹침, 절대 문턱 -70 LUFS, 상대 문턱 -10 LU
 * - 스테레오(왼쪽, 오른쪽) 기준이며 두 채널의 가중치는 1입니다
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 * @returns {number} LUFS (소리가 없거나 400ms 보다 짧으면 -Infinity)
 */
export function integratedLufs(channels, sampleRate) {
  const stages = kWeightingStages(sampleRate);
  const filtered = channels.map(function (ch) {
    let x = ch;
    stages.forEach(function (st) { x = biquad(x, st); });
    return x;
  });
  const len = filtered[0].length;
  const block = Math.round(0.4 * sampleRate);
  const step = Math.round(0.1 * sampleRate);
  const blocks = [];
  for (let start = 0; start + block <= len; start += step) {
    let z = 0;
    for (const ch of filtered) {
      let s = 0;
      for (let i = start; i < start + block; i++) s += ch[i] * ch[i];
      z += s / block;
    }
    blocks.push(z);
  }
  const lufsOf = function (z) { return -0.691 + 10 * Math.log10(z); };
  const abs = blocks.filter(function (z) { return z > 0 && lufsOf(z) > -70; });
  if (!abs.length) return -Infinity;
  const meanAbs = abs.reduce(function (s, z) { return s + z; }, 0) / abs.length;
  const gate = lufsOf(meanAbs) - 10;
  const rel = abs.filter(function (z) { return lufsOf(z) > gate; });
  if (!rel.length) return -Infinity;
  return lufsOf(rel.reduce(function (s, z) { return s + z; }, 0) / rel.length);
}

/**
 * 현재 렌더링을 골든과 비교해 통과 여부를 판정
 * @param {Float32Array[]} current
 * @param {Float32Array[]} golden
 * @param {number} sampleRate
 * @param {object} [tolerance]  DEFAULT_TOLERANCE 의 일부를 덮어씀
 * @returns {{pass:boolean, failures:string[], maxDiff:number, rmsDiffDb:number, lufsCurrent:number, lufsGolden:number, lufsDiff:number, peak:number}}
 */
export function compareRenders(current, golden, sampleRate, tolerance) {
  const tol = Object.assign({}, DEFAULT_TOLERANCE, tolerance || {});
  const failures = [];
  const peak = peakOf(current);
  if (current.length !== golden.length || current[0].length !== golden[0].length) {
    failures.push('길이가 다름: 현재 ' + current[0].length + ' 프레임, 골든 ' + golden[0].length + ' 프레임');
    return { pass: false, failures: failures, maxDiff: NaN, rmsDiffDb: NaN, lufsCurrent: NaN, lufsGolden: NaN, lufsDiff: NaN, peak: peak };
  }
  if (peak < tol.minPeak) failures.push('소리가 거의 없음: 피크 ' + peak.toExponential(2));
  const d = diffMetrics(current, golden);
  const lc = integratedLufs(current, sampleRate);
  const lg = integratedLufs(golden, sampleRate);
  const lufsDiff = lc === lg ? 0 : Math.abs(lc - lg);
  if (d.maxDiff > tol.maxDiff) failures.push('샘플 최대 차이 ' + d.maxDiff.toExponential(2) + ' > ' + tol.maxDiff);
  if (d.rmsDiffDb > tol.rmsDb) failures.push('차이 RMS ' + d.rmsDiffDb.toFixed(1) + ' dBFS > ' + tol.rmsDb + ' dBFS');
  if (!(lufsDiff <= tol.lufs)) failures.push('LUFS 차이 ' + lufsDiff.toFixed(3) + ' LU > ' + tol.lufs + ' LU');
  return { pass: failures.length === 0, failures: failures, maxDiff: d.maxDiff, rmsDiffDb: d.rmsDiffDb, lufsCurrent: lc, lufsGolden: lg, lufsDiff: lufsDiff, peak: peak };
}
