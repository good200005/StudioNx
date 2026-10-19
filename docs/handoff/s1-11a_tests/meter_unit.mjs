// S1-11a 미터 순수 함수 시험 — 피크 계산, dB 눈금, 막대 내려가는 속도 (소리 · 브라우저 불필요)
// 실행: node docs/handoff/s1-11a_tests/meter_unit.mjs
import { peakOf, peakToPercent, meterStep, METER_FLOOR_DB } from '../../../studionx/frontend/static/js/audio/meter.js';

let ok = 0, bad = 0;
const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };

t('peak', peakOf([0.1, -0.7, 0.3]) === 0.7);
t('peak-empty', peakOf([]) === 0);
t('floor', METER_FLOOR_DB === -60);
t('pct-full', peakToPercent(1) === 100);
t('pct-over', peakToPercent(2) === 100);
t('pct-silent', peakToPercent(0) === 0);
t('pct-tiny', peakToPercent(0.0001) === 0);
t('pct-minus6', Math.abs(peakToPercent(0.5) - 90) < 0.5);
t('pct-minus20', Math.abs(peakToPercent(0.1) - (100 - 20 / 60 * 100)) < 1e-9);
t('pct-bad', peakToPercent(NaN) === 0 && peakToPercent(-1) === 0);
t('step-up', meterStep(10, 60, 9) === 60);
t('step-down', meterStep(60, 10, 9) === 51);
t('step-down-floor', meterStep(12, 10, 9) === 10);
t('step-same', meterStep(30, 30, 9) === 30);

console.log(ok + ' passed, ' + bad + ' failed');
process.exit(bad === 0 ? 0 : 1);
