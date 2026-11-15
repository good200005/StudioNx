// S1-15 내보내기 시험 — OfflineAudioContext 렌더가 오토메이션(볼륨, 이펙트 노브)과 클립 페이드를 반영하는지 숫자로 확인합니다.
// 악기 노브(Sampler gain) 레인도 확인합니다. 서버 8001 이 static 파일을 내주는 것만 필요합니다. 실행: node docs/handoff/s1-15_tests/render_automation.mjs
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const b = await launch(9581, 800, 600);
await b.goto('http://localhost:8001/home.html');

await b.ev(`(async () => {
  const wav = await import('/static/js/audio/wav.js');
  const off = await import('/static/js/audio/offline.js');
  const schemaOf = (p) => Object.keys(p).map((k) => ({ key: k, default: p[k] }));
  const sine = (secs) => { const n = Math.round(44100 * secs), d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100); return wav.encodeWav([d], 44100, 16, { dither: false }).buffer; };
  const bytes = sine(6);
  const smp = sine(2);
  window.__r = async (cfg) => {
    const tracks = [{ track_id: 2, track_type: 'MIDI', volume_db: 0, pan: 0, is_muted: false, is_solo: false }, { track_id: 1, track_type: 'AUDIO', volume_db: 0, pan: 0, is_muted: false, is_solo: false }, { track_id: 99, track_type: 'MASTER', volume_db: 0 }];
    const fx = cfg.effects || {};
    const out = await off.renderOffline({
      tracks, audioClips: cfg.audioClips || [], midiClips: cfg.midiClips || [],
      getInstruments: (id) => (id === 2 ? (cfg.instruments || []) : []).map((l, i) => ({ id: i + 1, plugin_code: 'sampler', schema: schemaOf(l.params), params: l.params, volume_db: 0, pan: 0, is_enabled: true })),
      getEffects: (id) => (fx[id] || []).map((e, i) => ({ id: 'e' + id + '_' + i, plugin_code: e.code, schema: schemaOf(e.params), params: e.params, is_bypassed: false, slot_index: i })),
      getAutomation: cfg.lanes ? () => cfg.lanes : undefined,
      bpm: 120, tempoChanges: [], startTick: 0, endTick: cfg.end, tailSec: 0, sampleRate: 44100,
      loadSampleBytes: (id) => Promise.resolve((id === 2 ? smp : bytes).slice(0)),
    });
    window.__last = out;
    return { frames: out.frames };
  };
  window.__pk = (t0, t1) => { const sr = window.__last.sampleRate, d = window.__last.channels[0].subarray(Math.floor(t0 * sr), Math.floor(t1 * sr)); let p = 0; for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); return p; };
  return 1;
})()`);

const R = (cfg) => b.ev('window.__r(' + JSON.stringify(cfg) + ')');
const pk = (a, c) => b.ev('window.__pk(' + a + ',' + c + ')');
const near = (x, y, tol) => Math.abs(x - y) <= tol;
const TPB = 3840;   // 120BPM 에서 1마디 = 2초
const clip = (o) => Object.assign({ track_id: 1, sample_id: 1, start_tick: 0, length_tick: TPB * 3, offset_tick: 0, gain_db: 0, is_looped: false, pitch_semitones: 0 }, o || {});
const lane = (o) => Object.assign({ track_id: 1, target_type: 'VOLUME', track_plugin_id: null, track_instrument_id: null, param_index: 0, is_enabled: true }, o);

// A. 기준: 오토메이션 없음 → 6초 내내 피크 약 0.5
await R({ audioClips: [clip()], end: TPB * 3 });
check('A 기준: 처음과 끝의 피크가 같음(0.5)', near(await pk(0.2, 0.6), 0.5, 0.03) && near(await pk(5.2, 5.6), 0.5, 0.03));

// B. 볼륨 레인: 0dB → -20dB 직선 (6초). 3초 지점은 -10dB → 0.5 × 10^(-0.5) ≈ 0.158
await R({ audioClips: [clip()], end: TPB * 3, lanes: [lane({ points: [{ tick: 0, value: 0, curve: 0 }, { tick: TPB * 3, value: -20, curve: 0 }] })] });
const b1 = await pk(0.1, 0.3), b2 = await pk(2.9, 3.1), b3 = await pk(5.7, 5.9);
check('B 볼륨 오토메이션: 시작 ≈0.5, 3초 ≈0.158, 끝 ≈0.06 (점점 작아짐)', near(b1, 0.49, 0.04) && near(b2, 0.158, 0.03) && near(b3, 0.055, 0.02) && b1 > b2 && b2 > b3, [b1, b2, b3].join(' / '));

// C. 이펙트 노브 레인: Gain 이펙트의 gain 을 0dB → -20dB (param_index 0)
await R({
  audioClips: [clip()], end: TPB * 3,
  effects: { 1: [{ code: 'gain', params: { gain: 0, pan: 0, phase_invert: false } }] },
  lanes: [lane({ target_type: 'DEVICE_PARAM', track_plugin_id: 'e1_0', points: [{ tick: 0, value: 0, curve: 0 }, { tick: TPB * 3, value: -20, curve: 0 }] })],
});
const c1 = await pk(0.1, 0.3), c2 = await pk(5.7, 5.9);
check('C 이펙트 노브 오토메이션: 시작 ≈0.5, 끝 ≈0.06', near(c1, 0.49, 0.04) && near(c2, 0.055, 0.02), c1 + ' / ' + c2);

// D. 사용 안 함(is_enabled false) 레인은 무시
await R({ audioClips: [clip()], end: TPB * 3, lanes: [lane({ is_enabled: false, points: [{ tick: 0, value: -40, curve: 0 }, { tick: TPB * 3, value: -40, curve: 0 }] })] });
check('D 꺼진 레인은 적용하지 않음', near(await pk(2.9, 3.1), 0.5, 0.03));

// E. 클립 페이드: 앞 1마디(2초) 페이드 인, 뒤 1마디 페이드 아웃 (곡선 0 = 직선)
await R({ audioClips: [clip({ fade_in_tick: TPB, fade_out_tick: TPB, fade_in_curve: 0, fade_out_curve: 0 })], end: TPB * 3 });
const e1 = await pk(0.0, 0.05), e2 = await pk(0.95, 1.05), e3 = await pk(2.5, 3.5), e4 = await pk(5.95, 6.0);
check('E 페이드: 시작 ≈0, 1초 ≈0.25, 가운데 ≈0.5, 끝 ≈0', e1 < 0.03 && near(e2, 0.25, 0.04) && near(e3, 0.5, 0.03) && e4 < 0.03, [e1, e2, e3, e4].join(' / '));

// F. 악기 노브 레인: Sampler gain(param_index 4) 을 1 → 0.2 직선 (3마디). 음마다 앞부분 피크가 줄어야 함
const SP = { sample_id: 2, mode: 'classic', root_note: 60, loop: false, gain: 1, tune: 0, attack: 0, decay: 0, sustain: 1, release: 0.05 };
const nt = (tick) => ({ pitch: 60, velocity: 127, start_tick: tick, length_tick: 960 });
const midi = { track_id: 2, start_tick: 0, length_tick: TPB * 3, offset_tick: 0, notes: [nt(0), nt(TPB), nt(TPB * 2)] };
const insLane = (pts) => lane({ track_id: 2, target_type: 'INSTRUMENT_PARAM', track_instrument_id: 1, param_index: 4, points: pts });
await R({ midiClips: [midi], instruments: [{ params: SP }], end: TPB * 3 });
const f0 = await pk(4.1, 4.4);
await R({ midiClips: [midi], instruments: [{ params: SP }], end: TPB * 3, lanes: [insLane([{ tick: 0, value: 1, curve: 0 }, { tick: TPB * 3, value: 0.2, curve: 0 }])] });
const f1 = await pk(0.05, 0.3), f2 = await pk(2.05, 2.3), f3 = await pk(4.05, 4.3);
check('F 악기 노브 오토메이션: 음마다 소리가 점점 작아짐 (레인 없을 때 마지막 음과 비교)', f1 > f2 && f2 > f3 && f3 < f0 * 0.6 && f1 > f0 * 0.8, [f0, f1, f2, f3].join(' / '));

summary();
await b.close();
