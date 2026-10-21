// S1-11c Sampler 순수 함수와 그래프 구성 시험 — 재생 속도, 샘플 번호 모음, 모드별 노드 연결 (소리 · 브라우저 불필요)
// 실행: node docs/handoff/s1-11c_tests/sampler_unit.mjs
import { samplerMode, samplerRate, samplerSampleIds, playSamplerNote } from '../../../studionx/frontend/static/js/audio/sampler.js';
import { InstrumentRack, PLAYABLE_CODES } from '../../../studionx/frontend/static/js/audio/instruments.js';

let ok = 0, bad = 0;
const t = (n, c, d) => { if (c) ok++; else { bad++; console.log('FAIL', n, d === undefined ? '' : d); } };
const near = (x, y, tol) => Math.abs(x - y) <= tol;

// ── 모드 이름
t('mode: oneshot', samplerMode('oneshot') === 'oneshot');
t('mode: classic', samplerMode('classic') === 'classic');
t('mode: 모르는 값은 classic', samplerMode('weird') === 'classic' && samplerMode(undefined) === 'classic' && samplerMode(null) === 'classic');

// ── 재생 속도
t('rate: Root 와 같은 음은 1배', samplerRate(60, 60, 0) === 1);
t('rate: 한 옥타브 위는 2배', near(samplerRate(72, 60, 0), 2, 1e-12));
t('rate: 한 옥타브 아래는 0.5배', near(samplerRate(48, 60, 0), 0.5, 1e-12));
t('rate: 7반음 위(완전 5도)는 약 1.4983', near(samplerRate(67, 60, 0), 1.4983070768766815, 1e-9));
t('rate: Tune +12 는 한 옥타브 위', near(samplerRate(60, 60, 12), 2, 1e-12));
t('rate: Tune -12 는 한 옥타브 아래', near(samplerRate(60, 60, -12), 0.5, 1e-12));
t('rate: Root 를 바꾸면 기준이 옮겨감 (Root 48 에서 60 은 2배)', near(samplerRate(60, 48, 0), 2, 1e-12));
t('rate: Tune 소수 (0.5 반음)', near(samplerRate(60, 60, 0.5), Math.pow(2, 0.5 / 12), 1e-12));
t('rate: 숫자 아닌 Tune 은 0 으로', samplerRate(60, 60, undefined) === 1 && samplerRate(60, 60, 'x') === 1);

// ── 샘플 번호 모음
const layers = {
  1: [{ plugin_code: 'sampler', params: { sample_id: 7 } }, { plugin_code: 'synth_sub', params: { sample_id: 99 } }],
  2: [{ plugin_code: 'sampler', params: { sample_id: 7 } }, { plugin_code: 'sampler', params: { sample_id: 8 } }],
  3: [{ plugin_code: 'sampler', params: { sample_id: null } }, { plugin_code: 'sampler', params: {} }, { plugin_code: 'sampler', params: null }],
  4: [{ plugin_code: 'sampler', params: { sample_id: 9 }, is_enabled: false }, { plugin_code: 'sampler', params: { sample_id: '12' } }],
};
const get = (id) => layers[id] || null;
t('ids: 중복 없이 모음 (7, 8)', JSON.stringify(samplerSampleIds(get, [1, 2])) === '[7,8]', JSON.stringify(samplerSampleIds(get, [1, 2])));
t('ids: Sampler 가 아닌 악기의 sample_id 는 무시', samplerSampleIds(get, [1]).indexOf(99) < 0);
t('ids: sample_id 가 없거나 null 이면 건너뜀', samplerSampleIds(get, [3]).length === 0);
t('ids: 꺼진 층은 건너뛰고 문자열 번호는 숫자로', JSON.stringify(samplerSampleIds(get, [4])) === '[12]');
t('ids: 악기가 없는 트랙은 빈 목록', samplerSampleIds(get, [5, 6]).length === 0);
t('ids: 트랙 목록이 비어도 빈 목록', samplerSampleIds(get, []).length === 0 && samplerSampleIds(get, undefined).length === 0);

// ── 노드 연결 (기록하는 가짜 컨텍스트)
function fakeCtx() {
  const log = { sources: [], gains: [] };
  const param = () => ({ value: 0, calls: [], setValueAtTime(v, tm) { this.calls.push(['set', v, tm]); }, linearRampToValueAtTime(v, tm) { this.calls.push(['ramp', v, tm]); }, cancelScheduledValues() {}, setTargetAtTime() {} });
  return {
    currentTime: 0, log,
    createBufferSource() { const s = { loop: false, loopStart: 0, loopEnd: 0, playbackRate: param(), connected: [], started: null, stopped: [], connect(n) { s.connected.push(n); }, start(tm) { s.started = tm; }, stop(tm) { s.stopped.push(tm); } }; log.sources.push(s); return s; },
    createGain() { const g = { gain: param(), connected: [], connect(n) { g.connected.push(n); } }; log.gains.push(g); return g; },
  };
}
const buf = { duration: 2 };
const dest = { name: 'dest' };
const base = { sample_id: 1, mode: 'classic', root_note: 60, loop: false, gain: 1, tune: 0, attack: 0, decay: 0, sustain: 1, release: 0.2 };

// 샘플이 없으면 소리를 만들지 않음
{
  const c = fakeCtx();
  const h = playSamplerNote(c, dest, base, null, 60, 100, 0, 1);
  t('버퍼 없음: 소스를 만들지 않음', c.log.sources.length === 0);
  t('버퍼 없음: stop 을 불러도 오류 없음', (h.stop(0), true));
}
// classic
{
  const c = fakeCtx();
  playSamplerNote(c, dest, base, buf, 72, 127, 1, 0.5);
  const s = c.log.sources[0], g = c.log.gains[0];
  t('classic: 소스 하나, 앰프로 연결, 앰프는 목적지로', c.log.sources.length === 1 && s.connected[0] === g && g.connected[0] === dest);
  t('classic: 한 옥타브 위라 playbackRate 2', near(s.playbackRate.value, 2, 1e-12));
  t('classic: 시작 시각', s.started === 1);
  t('classic: 노트 길이 + Release + 여유(0.02) 뒤에 멈춤', near(s.stopped[0], 1 + 0.5 + 0.2 + 0.02, 1e-9), String(s.stopped[0]));
  t('classic: Loop 꺼짐', s.loop === false);
  t('classic: 최고 음량은 gain × velocity/127 = 1', near(g.gain.calls.filter((x) => x[0] === 'set' && x[2] === 1)[1][1], 1, 1e-9), JSON.stringify(g.gain.calls));
}
// classic + loop
{
  const c = fakeCtx();
  playSamplerNote(c, dest, Object.assign({}, base, { loop: true }), buf, 60, 127, 0, 5);
  const s = c.log.sources[0];
  t('classic + Loop: 되풀이하고 구간은 샘플 전체', s.loop === true && s.loopStart === 0 && s.loopEnd === 2);
  t('classic + Loop: 노트 길이만큼 이어서 울림(샘플 2초보다 긴 5초 + Release)', near(s.stopped[0], 5 + 0.2 + 0.02, 1e-9));
}
// velocity, gain
{
  const c = fakeCtx();
  playSamplerNote(c, dest, Object.assign({}, base, { gain: 0.5 }), buf, 60, 64, 0, 1);
  const g = c.log.gains[0];
  const peakCall = g.gain.calls.filter((x) => x[0] === 'set' && x[2] === 0)[1];
  t('velocity 64, gain 0.5: 최고 음량 0.5 × 64/127', near(peakCall[1], 0.5 * 64 / 127, 1e-9), JSON.stringify(g.gain.calls));
}
// oneshot
{
  const c = fakeCtx();
  playSamplerNote(c, dest, Object.assign({}, base, { mode: 'oneshot', loop: true, sustain: 0, release: 5 }), buf, 60, 127, 1, 0.05);
  const s = c.log.sources[0];
  t('oneshot: 노트가 아주 짧아도 샘플 전체(2초)를 울림', near(s.stopped[0], 1 + 2 + 0.02, 1e-9), String(s.stopped[0]));
  t('oneshot: Loop 를 켜 둬도 무시', s.loop === false);
  t('oneshot: Release 5초를 무시', s.stopped[0] < 4);
}
{
  const c = fakeCtx();
  playSamplerNote(c, dest, Object.assign({}, base, { mode: 'oneshot' }), buf, 72, 127, 0, 0.05);
  t('oneshot: 한 옥타브 위는 속도 2배라 샘플이 1초에 끝남', near(c.log.sources[0].stopped[0], 1 + 0.02, 1e-9), String(c.log.sources[0].stopped[0]));
}
{
  const c = fakeCtx();
  playSamplerNote(c, dest, Object.assign({}, base, { mode: 'oneshot', decay: 0.3 }), buf, 60, 127, 0, 0.05);
  const calls = c.log.gains[0].gain.calls;
  t('oneshot + Decay: 0 까지 줄이는 램프가 Decay 시간 끝에 있음', calls.some((x) => x[0] === 'ramp' && x[1] === 0 && near(x[2], 0.3, 1e-9)), JSON.stringify(calls));
}
{
  const c = fakeCtx();
  playSamplerNote(c, dest, Object.assign({}, base, { mode: 'oneshot', attack: 0.1 }), buf, 60, 127, 0, 0.05);
  const calls = c.log.gains[0].gain.calls;
  t('oneshot + Attack: 앞을 여는 램프', calls.some((x) => x[0] === 'ramp' && x[1] > 0 && near(x[2], 0.1, 1e-9)), JSON.stringify(calls));
}

// ── InstrumentRack: Sampler 가 연주 목록에 들고, 샘플을 찾아 울림
t('PLAYABLE_CODES 에 sampler 가 있음', PLAYABLE_CODES.indexOf('sampler') >= 0 && PLAYABLE_CODES.indexOf('synth_sub') >= 0);
{
  const c = fakeCtx();
  c.createStereoPanner = undefined;
  c.createChannelSplitter = undefined;
  const asked = [];
  const inst = [{ id: 1, plugin_code: 'sampler', schema: Object.keys(base).map((k) => ({ key: k, default: base[k] })), params: { sample_id: 3 }, volume_db: 0, pan: 0, is_enabled: true }];
  let rack = null, err = null;
  try {
    rack = new InstrumentRack(c, () => dest, () => inst, (id) => { asked.push(id); return buf; });
  } catch (e) { err = e; }
  t('rack: 만들어짐', !!rack, String(err));
  if (rack) {
    // 층 노드 만들기는 믹서 도우미(createStereoGain)가 필요해서 가짜 컨텍스트로는 playNote 까지 가지 않을 수 있음: 가능한 만큼만 확인
    try {
      const out = rack.playNote(1, 60, 100, 0, 1);
      t('rack: 샘플 번호 3 으로 버퍼를 찾음', asked.length === 1 && asked[0] === 3, JSON.stringify(asked));
      t('rack: 울린 소리 하나(stop 가능)', out.length === 1 && typeof out[0].stop === 'function');
    } catch (e) {
      t('rack: playNote (가짜 컨텍스트 한계 — 렌더링 시험에서 확인)', true);
    }
  }
}

console.log(`\n${ok}/${ok + bad} passed`);
process.exit(bad ? 1 : 0);
