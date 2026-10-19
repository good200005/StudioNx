// S1-11a 이펙트 순수 함수 시험 — 딜레이 시간 계산, 잔향 임펄스 (소리 · 브라우저 불필요)
// 실행: node docs/handoff/s1-11a_tests/effects_unit.mjs
import { delaySeconds, makeImpulse, compressorAutoMakeupDb, EFFECT_CODES } from '../../../studionx/frontend/static/js/audio/effects.js';

let ok = 0, bad = 0;
const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };

t('free', delaySeconds({ sync: false, time: 0.35 }, 120) === 0.35);
t('sync-1/4', Math.abs(delaySeconds({ sync: true, division: '1/4' }, 120) - 0.5) < 1e-9);
t('sync-1/8', Math.abs(delaySeconds({ sync: true, division: '1/8' }, 120) - 0.25) < 1e-9);
t('sync-1/8d', Math.abs(delaySeconds({ sync: true, division: '1/8d' }, 120) - 0.375) < 1e-9);
t('sync-1/16-60bpm', Math.abs(delaySeconds({ sync: true, division: '1/16' }, 60) - 0.25) < 1e-9);
t('clamp-max', delaySeconds({ sync: false, time: 99 }, 120) === 4);
t('clamp-min', delaySeconds({ sync: false, time: -1 }, 120) >= 0.001);
t('sync-bad-bpm', delaySeconds({ sync: true, division: '1/4' }, 0) === 0.5);

const a = makeImpulse(44100, 1, 0.5, 0);
const b = makeImpulse(44100, 1, 0.5, 0);
const c = makeImpulse(44100, 1, 0.5, 1);
t('len', a.length === 44100);
t('deterministic', a.every((v, i) => v === b[i]));
t('channels-differ', a.some((v, i) => v !== c[i]));
const energy = (x, s, e) => { let r = 0; for (let i = s; i < e; i++) r += x[i] * x[i]; return r; };
t('decays', energy(a, 0, 4410) > energy(a, 39690, 44100) * 50);
const hf = (x) => { let r = 0; for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1]; r += d * d; } return r; };
t('damping-dulls', hf(makeImpulse(44100, 1, 1, 0)) < hf(makeImpulse(44100, 1, 0, 0)) * 0.2);
t('automakeup-limiter', Math.abs(compressorAutoMakeupDb(-12, 20) - 6.84) < 1e-9);
t('automakeup-ratio1', compressorAutoMakeupDb(-20, 1) === 0);
t('automakeup-positive-thr', compressorAutoMakeupDb(5, 4) === 0);
t('codes', ['gain', 'eq3', 'compressor', 'limiter', 'delay', 'reverb'].every((k) => EFFECT_CODES.indexOf(k) >= 0));

console.log(ok + ' passed, ' + bad + ' failed');
process.exit(bad === 0 ? 0 : 1);
