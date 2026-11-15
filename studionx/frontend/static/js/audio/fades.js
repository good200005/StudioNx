// 클립 페이드 (S1-15 항목 i) — Ableton 의 Fade In Start / Fade Out End 핸들과 Fade Curve 핸들에 해당합니다.
// - 페이드 길이는 tick, 곡선은 -1~1 (0 은 직선). 화면의 오토메이션 곡선과 같은 지수 모양(K=6)을 씁니다
// - 시작 페이드와 끝 페이드는 겹칠 수 없으므로 합이 클립 길이를 넘으면 끝 페이드를 줄입니다

import { curveShape } from './automation.js';

const STEPS = 24;   // 페이드 하나를 나누는 구간 수 (이 정도면 귀로 계단이 들리지 않음)

/** 클립 길이 안에 들어가도록 다듬은 페이드 길이 [들어옴, 나감] (tick) */
export function fadeLengths(clip) {
  const len = Math.max(0, Number(clip.length_tick) || 0);
  const fin = Math.min(Math.max(0, Number(clip.fade_in_tick) || 0), len);
  const fout = Math.min(Math.max(0, Number(clip.fade_out_tick) || 0), len - fin);
  return [fin, fout];
}

/** 클립 시작에서 rel tick 떨어진 곳의 페이드 배율 (0~1) */
export function fadeGainAt(clip, rel) {
  const len = Number(clip.length_tick) || 0;
  const l = fadeLengths(clip);
  let g = 1;
  if (l[0] > 0 && rel < l[0]) g *= curveShape(Math.max(0, rel) / l[0], clip.fade_in_curve, true);
  if (l[1] > 0 && rel > len - l[1]) g *= curveShape(Math.max(0, len - rel) / l[1], clip.fade_out_curve, true);
  return g;
}

/**
 * 재생 구간 [fromTick, toTick] (절대 tick)의 배율을 변하는 지점마다 [tick, 배율] 로 나열
 * - 페이드가 없으면 빈 배열
 */
export function fadePoints(clip, fromTick, toTick) {
  const l = fadeLengths(clip);
  if (!l[0] && !l[1]) return [];
  const start = Number(clip.start_tick) || 0;
  const len = Number(clip.length_tick) || 0;
  const ticks = [fromTick];
  function span(a, b) {
    for (let i = 1; i <= STEPS; i++) {
      const t = a + (b - a) * i / STEPS;
      if (t > fromTick && t < toTick) ticks.push(t);
    }
  }
  if (l[0]) span(start, start + l[0]);
  if (l[1]) span(start + len - l[1], start + len);
  ticks.push(toTick);
  ticks.sort(function (a, b) { return a - b; });
  return ticks.map(function (t) { return [t, fadeGainAt(clip, t - start)]; });
}
