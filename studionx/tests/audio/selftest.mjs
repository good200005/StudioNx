// 오디오 회귀 테스트 자체 시험 (S1-12)
// 회귀 테스트가 "믿을 만한 도구"인지 확인합니다: 비교 지표가 맞는지, 같은 코드는 늘 같은 소리가 나오는지(재현성),
// 소리가 조금이라도 달라지면 실제로 실패하는지(민감도), 소리가 아예 안 나는 경우를 잡는지.
// 실행: node studionx/tests/audio/selftest.mjs   (골든 파일이 있어야 하고, 프로젝트 파일은 건드리지 않음)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openRenderer, loadProjects, buildArgs, goldenPath } from './lib/runner.mjs';
import { compareRenders, diffMetrics, integratedLufs, peakOf, toDb, DEFAULT_TOLERANCE } from './lib/metrics.mjs';
import { readWav, writeFloatWav } from './lib/wavio.mjs';

let ok = 0, bad = 0;
const t = function (name, cond, detail) {
  if (cond) ok++; else bad++;
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + (detail === undefined ? '' : detail)));
};
const near = function (x, y, tol) { return Math.abs(x - y) <= tol; };
const clone = function (o) { return JSON.parse(JSON.stringify(o)); };

/* ── 1. 지표 (브라우저 불필요) ── */
const sineStereo = function (freq, amp, secs, sr) {
  const n = Math.round(secs * sr), l = new Float32Array(n);
  for (let i = 0; i < n; i++) l[i] = amp * Math.sin(2 * Math.PI * freq * i / sr);
  return [l, Float32Array.from(l)];
};
t('toDb: 1 은 0dB, 0.1 은 -20dB, 0 은 -Infinity', toDb(1) === 0 && near(toDb(0.1), -20, 1e-9) && toDb(0) === -Infinity);
t('peakOf: 모든 채널의 절댓값 최대', peakOf([Float32Array.of(0.1, -0.7), Float32Array.of(0.3, 0.2)]) > 0.69 && peakOf([Float32Array.of(0.1, -0.7), Float32Array.of(0.3, 0.2)]) < 0.71);

for (const sr of [44100, 48000]) {
  const full = sineStereo(997, 1, 3, sr);
  const lf = integratedLufs(full, sr);
  t('LUFS ' + sr + 'Hz: 997Hz 풀스케일 스테레오 사인은 약 0 LUFS (BS.1770 기준)', near(lf, 0, 0.1), lf);
  const half = sineStereo(997, 0.1, 3, sr);
  t('LUFS ' + sr + 'Hz: 진폭 0.1(-20dB)이면 정확히 20 LU 낮음', near(lf - integratedLufs(half, sr), 20, 0.01), lf - integratedLufs(half, sr));
}
{
  const sr = 48000;
  const loud = sineStereo(997, 0.5, 2, sr);
  // 소리 뒤에 붙인 구간(무음 또는 -40dB)이 2초든 10초든 값이 같아야 함 (문턱이 걸러내므로 길이와 무관).
  // 소리와 맞닿은 경계 블록의 영향은 두 경우에 똑같이 들어갑니다.
  const padded = function (secs, gain) {
    return loud.map(function (ch) {
      const o = new Float32Array(ch.length + Math.round(secs * sr));
      o.set(ch);
      if (gain) for (let i = ch.length; i < o.length; i++) o[i] = gain * 0.5 * Math.sin(2 * Math.PI * 997 * i / sr);
      return o;
    });
  };
  const l2 = integratedLufs(padded(2, 0), sr), l10 = integratedLufs(padded(10, 0), sr);
  t('LUFS: 뒤쪽 무음의 길이(2초와 10초)가 달라도 값이 같음 (절대 문턱 -70 LUFS)', near(l2, l10, 0.01), l2 + ' / ' + l10);
  const q2 = integratedLufs(padded(2, 0.01), sr), q10 = integratedLufs(padded(10, 0.01), sr);
  t('LUFS: 뒤쪽 -40dB 구간의 길이(2초와 10초)가 달라도 값이 같음 (상대 문턱 -10 LU)', near(q2, q10, 0.01), q2 + ' / ' + q10);
  t('LUFS: 무음을 붙여도 값이 0.5 LU 넘게 내려가지 않음 (경계 블록만 영향)', integratedLufs(loud, sr) - l10 < 0.5, integratedLufs(loud, sr) + ' / ' + l10);
  t('LUFS: 완전한 무음은 -Infinity', integratedLufs([new Float32Array(sr), new Float32Array(sr)], sr) === -Infinity);
  t('LUFS: 400ms 보다 짧으면 -Infinity (블록이 없음)', integratedLufs(sineStereo(997, 1, 0.3, sr), sr) === -Infinity);
}
{
  const a = [Float32Array.of(0, 0, 0, 0), Float32Array.of(0, 0, 0, 0)];
  const b = [Float32Array.of(0.001, 0.001, 0.001, 0.001), Float32Array.of(0.001, 0.001, 0.001, 0.001)];
  const d = diffMetrics(a, b);
  t('diffMetrics: 모든 샘플이 0.001 달라지면 최대 0.001, RMS -60dBFS', near(d.maxDiff, 0.001, 1e-9) && near(d.rmsDiffDb, -60, 1e-6), JSON.stringify(d));
  t('diffMetrics: 같은 신호는 최대 0, RMS -Infinity', diffMetrics(a, a).maxDiff === 0 && diffMetrics(a, a).rmsDiffDb === -Infinity);
}
{
  const sr = 44100;
  const g = sineStereo(440, 0.5, 1, sr);
  t('compareRenders: 똑같으면 통과', compareRenders(g, g, sr).pass);
  const low = g.map(function (ch) { return ch.map(function (v) { return v * 0.99; }); });
  const r = compareRenders(low, g, sr);
  t('compareRenders: 음량이 0.087dB(0.99배)만 달라도 LUFS 로 실패', !r.pass && r.failures.some(function (f) { return f.indexOf('LUFS') === 0; }), JSON.stringify(r.failures));
  const tiny = g.map(function (ch) { return ch.map(function (v) { return v + 1e-6; }); });
  t('compareRenders: 1e-6 의 잡음 정도는 통과 (-120 dBFS)', compareRenders(tiny, g, sr).pass);
  const silent = [new Float32Array(g[0].length), new Float32Array(g[0].length)];
  const s = compareRenders(silent, silent, sr);
  t('compareRenders: 골든도 무음이어서 같더라도 "소리가 거의 없음"으로 실패', !s.pass && s.failures.some(function (f) { return f.indexOf('소리가 거의 없음') === 0; }), JSON.stringify(s.failures));
  const short = [g[0].slice(0, 1000), g[1].slice(0, 1000)];
  t('compareRenders: 길이가 다르면 실패', !compareRenders(short, g, sr).pass);
  t('compareRenders: 허용 오차를 프로젝트별로 덮어쓸 수 있음', compareRenders(low, g, sr, { lufs: 0.2, maxDiff: 0.01, rmsDb: -30 }).pass);
  t('기본 허용 오차는 PRD 예시(RMS -80dBFS)와 같음', DEFAULT_TOLERANCE.rmsDb === -80);
}
{
  const f = path.join(os.tmpdir(), 'studionx_wavio_selftest.wav');
  const ch = sineStereo(440, 0.77, 0.5, 44100);
  writeFloatWav(f, ch, 44100);
  const back = readWav(f);
  let same = back.channels.length === 2 && back.frames === ch[0].length && back.sampleRate === 44100 && back.bitDepth === 32;
  for (let c = 0; c < 2 && same; c++) for (let i = 0; i < ch[c].length; i++) if (back.channels[c][i] !== ch[c][i]) { same = false; break; }
  t('WAV 쓰기와 읽기: 32bit float 이 한 비트도 안 틀리고 돌아옴', same);
  fs.rmSync(f, { force: true });
}

/* ── 2. 브라우저 렌더링: 골든 통과, 재현성, 민감도 ── */
const projects = loadProjects();
const byName = {};
projects.forEach(function (p) { byName[p.name] = p; });
t('테스트 프로젝트가 3~5개 있음', projects.length >= 3 && projects.length <= 5, projects.length);
t('프로젝트마다 골든 WAV 가 있음', projects.every(function (p) { return fs.existsSync(goldenPath(p.name)); }));

const r = await openRenderer();
try {
  const rendered = {};
  for (const p of projects) {
    const out = await r.render(buildArgs(p));
    rendered[p.name] = out;
    const g = readWav(goldenPath(p.name));
    const cmp = compareRenders(out.channels, g.channels, out.sampleRate, p.tolerance);
    t('골든 통과: ' + p.name, cmp.pass, JSON.stringify(cmp.failures));
    t('피크가 풀스케일(1.0) 아래: ' + p.name, cmp.peak < 1 && cmp.peak > 0.05, cmp.peak);
    t('샘플레이트와 프레임 수가 골든과 같음: ' + p.name, g.sampleRate === out.sampleRate && g.frames === out.frames);
  }
  // 재현성: 새로 렌더링해도 첫 번째와 완전히 같음
  const again = await r.render(buildArgs(byName.synth_basic));
  // 부동소수점 반올림 때문에 비트까지 같지는 않고 1e-7(-140 dBFS) 안팎으로 달라질 수 있음. 허용 오차(1e-3)보다 1만 배 작음
  const repro = diffMetrics(again.channels, rendered.synth_basic.channels).maxDiff;
  t('재현성: 같은 프로젝트를 다시 렌더링하면 최대 차이가 1e-6 이하 (허용 오차 1e-3 의 천분의 1)', repro <= 1e-6, repro);

  // 민감도: 소리를 조금 바꾼 프로젝트는 골든과 비교해 반드시 실패해야 함
  const mutate = [
    ['synth_basic', 'Synth 컷오프 +5% (1800 → 1890)', function (p) { p.instruments['1'][0].params.cutoff = 1890; }],
    ['synth_basic', '마스터 볼륨 -0.1dB', function (p) { p.master_db = p.master_db - 0.1; }],
    ['synth_basic', '노트 하나 반음 올림', function (p) { p.midiClips[0].notes[3].pitch += 1; }],
    ['synth_basic', 'LFO 깊이 0.35 → 0.30', function (p) { p.instruments['1'][0].params.lfo_depth = 0.3; }],
    ['sampler_drums', '킥을 One-Shot 에서 Classic 으로', function (p) { p.instruments['1'][0].params.mode = 'classic'; }],
    ['sampler_drums', '스네어 Decay 0.2 → 0.1', function (p) { p.instruments['2'][0].params.decay = 0.1; }],
    ['sampler_drums', '하이햇 노트 하나의 벨로시티 변경', function (p) { p.midiClips[2].notes[5].velocity = 40; }],
    ['sampler_drums', '베이스 Root 변경 (36 → 35)', function (p) { p.instruments['4'][0].params.root_note = 35; }],
    ['effects_chain', 'Delay 시간 0.25 → 0.26', function (p) { p.effects['1'][2].params.time = 0.26; }],
    ['effects_chain', 'Compressor 임계값 -18 → -17', function (p) { p.effects['1'][1].params.threshold = -17; }],
    ['effects_chain', 'Reverb 감쇠 1.6 → 1.7', function (p) { p.effects['1'][3].params.decay = 1.7; }],
    ['effects_chain', 'EQ 의 높은 음 +3 → +2.5', function (p) { p.effects['1'][0].params.high_gain = 2.5; }],
    ['effects_chain', '이펙트 순서 바꾸기 (Compressor 와 Delay)', function (p) { const e = p.effects['1']; const x = e[1]; e[1] = e[2]; e[2] = x; }],
    ['effects_chain', 'Limiter 천장 -1 → -3', function (p) { p.effects['1'][5].params.ceiling = -3; }],
    ['mixer_routing', '트랙 팬 -0.8 → -0.7', function (p) { p.tracks[0].pan = -0.7; }],
    ['mixer_routing', '뮤트한 트랙을 켬', function (p) { p.tracks[3].mute = false; }],
    ['mixer_routing', '클립 gain -1dB → -2dB', function (p) { p.audioClips[0].gain_db = -2; }],
    ['mixer_routing', '클립 음정 +7 → +6', function (p) { p.audioClips[2].pitch = 6; }],
    ['mixer_routing', '클립 시작 위치 0.5마디 → 0.52마디', function (p) { p.audioClips[1].startBar = 0.52; }],
    ['full_mix_tempo', '템포 변경 140 → 141 BPM', function (p) { p.tempoChanges[0].bpm = 141; }],
    ['full_mix_tempo', '템포 변경 위치 1마디 → 1.1마디', function (p) { p.tempoChanges[0].bar = 1.1; }],
    ['full_mix_tempo', 'Synth 필터 컷오프 700 → 740', function (p) { p.instruments['1'][0].params.cutoff = 740; }],
  ];
  for (const m of mutate) {
    const p = clone(byName[m[0]]);
    m[2](p);
    const out = await r.render(buildArgs(p));
    const g = readWav(goldenPath(m[0]));
    const cmp = compareRenders(out.channels, g.channels, out.sampleRate, byName[m[0]].tolerance);
    t('민감도: ' + m[0] + ' / ' + m[1] + ' → 실패해야 함', !cmp.pass, 'maxDiff=' + cmp.maxDiff + ' rms=' + cmp.rmsDiffDb + ' lufs=' + cmp.lufsDiff);
  }
  // 소리가 통째로 사라지는 사고: 클립 하나가 빠져도 잡힘, 아예 비어도 잡힘
  const empty = clone(byName.mixer_routing);
  empty.audioClips = [];
  const outEmpty = await r.render(buildArgs(empty));
  const gm = readWav(goldenPath('mixer_routing'));
  const ce = compareRenders(outEmpty.channels, gm.channels, outEmpty.sampleRate);
  t('모든 클립이 빠지면 실패 (소리 없음 + 골든과 다름)', !ce.pass && ce.failures.some(function (f) { return f.indexOf('소리가 거의 없음') === 0; }), JSON.stringify(ce.failures));
} finally {
  r.close();
}

console.log('\n' + ok + '/' + (ok + bad) + ' passed');
process.exit(bad ? 1 : 0);
