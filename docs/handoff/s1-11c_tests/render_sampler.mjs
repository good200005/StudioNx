// S1-11c Sampler 렌더링 시험 — 실제 OfflineAudioContext 로 Sampler 를 MIDI 노트로 울려 소리를 숫자로 확인합니다.
// 화면 · 로그인은 필요 없고, 서버 8001 이 static 파일을 내주는 것만 필요합니다.
// 실행: node docs/handoff/s1-11c_tests/render_sampler.mjs
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const b = await launch(9581, 800, 600);
await b.goto('http://localhost:8001/home.html');

await b.ev(`(async () => {
  const wav = await import('/static/js/audio/wav.js');
  const off = await import('/static/js/audio/offline.js');
  const schemaOf = (p) => Object.keys(p).map((k) => ({ key: k, default: p[k] }));

  // 시험용 샘플: 사인파 (secs 초, 진폭 amp, 주파수 freq) 를 WAV 바이트로
  const makeSamples = (samples) => {
    const bytes = {};
    Object.keys(samples || {}).forEach((id) => {
      const s = samples[id], n = Math.round(44100 * s.secs), d = new Float32Array(n);
      for (let i = 0; i < n; i++) d[i] = s.amp * Math.sin(2 * Math.PI * s.freq * i / 44100);
      bytes[id] = wav.encodeWav([d], 44100, 16, { dither: false }).buffer;
    });
    return bytes;
  };

  window.__r = async (cfg) => {
    const bytes = makeSamples(cfg.samples);
    const tracks = [{ track_id: 1, track_type: 'MIDI', volume_db: 0, pan: 0, is_muted: false, is_solo: false }, { track_id: 99, track_type: 'MASTER', volume_db: 0 }];
    const ins = cfg.instruments || [];
    let loads = 0;
    try {
      const out = await off.renderOffline({
        tracks, audioClips: [], midiClips: cfg.midiClips || [],
        getInstruments: (id) => (id === 1 ? ins : []).map((l, i) => ({ id: i + 1, plugin_code: l.code || 'sampler', schema: schemaOf(l.params), params: l.params, volume_db: 0, pan: 0, is_enabled: true })),
        getEffects: () => [],
        bpm: 120, tempoChanges: [], startTick: cfg.start, endTick: cfg.end, tailSec: cfg.tail || 0, sampleRate: 44100,
        loadSampleBytes: (id) => { loads++; return bytes[id] ? Promise.resolve(bytes[id].slice(0)) : Promise.reject(new Error('no sample ' + id)); },
      });
      window.__last = out;
      return { frames: out.frames, loads };
    } catch (e) { return { error: e.message, loads }; }
  };
  const sl = (t0, t1) => { const sr = window.__last.sampleRate, d = window.__last.channels[0]; return d.subarray(Math.max(0, Math.floor(t0 * sr)), Math.min(d.length, Math.floor(t1 * sr))); };
  window.__pk = (t0, t1) => { const d = sl(t0, t1); let p = 0; for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); return p; };
  window.__fq = (t0, t1) => { const d = sl(t0, t1); let n = 0; for (let i = 1; i < d.length; i++) if (d[i - 1] <= 0 && d[i] > 0) n++; return n / (t1 - t0); };
  return 1;
})()`);

const R = (cfg) => b.ev('window.__r(' + JSON.stringify(cfg) + ')');
const E = (expr) => b.ev(expr);
const near = (x, y, tol) => Math.abs(x - y) <= tol;
const TPB = 3840;   // 120BPM 에서 1마디 = 2초, 1박 = 0.5초 = 960tick
const note = (tick, len, pitch, vel) => ({ pitch: pitch == null ? 60 : pitch, velocity: vel == null ? 127 : vel, start_tick: tick, length_tick: len });
const mclip = (notes, o) => Object.assign({ track_id: 1, start_tick: 0, length_tick: TPB * 3, offset_tick: 0, notes }, o || {});
const P = (o) => Object.assign({ sample_id: 1, mode: 'classic', root_note: 60, loop: false, gain: 1, tune: 0, attack: 0, decay: 0, sustain: 1, release: 0.05 }, o || {});
const sine2 = { secs: 2, amp: 0.5, freq: 440 };   // 440Hz, 진폭 0.5, 2초
const run = (params, notes, o) => R(Object.assign({ samples: { 1: sine2 }, instruments: [{ params }], midiClips: [mclip(notes)], start: 0, end: TPB * 3 }, o || {}));

// ── A. Classic: 음높이
let r = await run(P(), [note(0, 960)]);
check('A 렌더링 성공, Sampler 의 샘플을 불러옴(1번)', !r.error && r.loads === 1, JSON.stringify(r));
check('A Root 와 같은 음(60): 440Hz', near(await E('window.__fq(0.05, 0.45)'), 440, 6), String(await E('window.__fq(0.05, 0.45)')));
check('A 피크가 약 0.5', near(await E('window.__pk(0.05, 0.45)'), 0.5, 0.03), String(await E('window.__pk(0.05, 0.45)')));
await run(P(), [note(0, 960, 72)]);
check('A 한 옥타브 위(72): 880Hz', near(await E('window.__fq(0.05, 0.45)'), 880, 10), String(await E('window.__fq(0.05, 0.45)')));
await run(P(), [note(0, 960, 48)]);
check('A 한 옥타브 아래(48): 220Hz', near(await E('window.__fq(0.05, 0.45)'), 220, 4), String(await E('window.__fq(0.05, 0.45)')));
await run(P({ root_note: 48 }), [note(0, 960, 60)]);
check('A Root 48 에서 60 을 치면 880Hz', near(await E('window.__fq(0.05, 0.45)'), 880, 10), String(await E('window.__fq(0.05, 0.45)')));
await run(P({ tune: 12 }), [note(0, 960, 60)]);
check('A Tune +12: 880Hz', near(await E('window.__fq(0.05, 0.45)'), 880, 10), String(await E('window.__fq(0.05, 0.45)')));

// ── B. Classic: 노트 길이와 Release
await run(P({ release: 0.1 }), [note(0, 960)]);
check('B 노트 길이(0.5초) 안에서는 소리가 남', (await E('window.__pk(0.2, 0.45)')) > 0.4);
check('B 노트 끝 + Release 가 지나면 조용함', (await E('window.__pk(0.7, 1.5)')) < 0.001, String(await E('window.__pk(0.7, 1.5)')));
await run(P({ release: 0.5 }), [note(0, 960)]);
check('B Release 0.5초: 노트가 끝난 직후에도 꼬리가 남음', (await E('window.__pk(0.52, 0.6)')) > 0.1, String(await E('window.__pk(0.52, 0.6)')));
await run(P({ attack: 0.2 }), [note(0, 1920)]);
check('B Attack 0.2초: 앞 20ms 는 작고 0.3초 뒤에는 충분히 큼', (await E('window.__pk(0, 0.02)')) < 0.15 && (await E('window.__pk(0.3, 0.9)')) > 0.4, (await E('window.__pk(0, 0.02)')) + ' / ' + (await E('window.__pk(0.3, 0.9)')));

// ── C. Classic: 샘플보다 긴 노트
await run(P({ release: 0.05 }), [note(0, 960 * 6)], { samples: { 1: { secs: 0.5, amp: 0.5, freq: 440 } } });
check('C Loop 꺼짐: 샘플(0.5초)이 끝나면 노트가 남아 있어도 조용함', (await E('window.__pk(0.7, 2.5)')) < 0.001, String(await E('window.__pk(0.7, 2.5)')));
await run(P({ release: 0.05, loop: true }), [note(0, 960 * 6)], { samples: { 1: { secs: 0.5, amp: 0.5, freq: 440 } } });
check('C Loop 켜짐: 샘플 길이를 넘겨도 노트가 끝날 때까지 소리가 이어짐', (await E('window.__pk(1.5, 2.8)')) > 0.4, String(await E('window.__pk(1.5, 2.8)')));
check('C Loop 켜짐: 되풀이 구간에서도 440Hz', near(await E('window.__fq(1.0, 2.5)'), 440, 8), String(await E('window.__fq(1.0, 2.5)')));

// ── D. One-Shot
await run(P({ mode: 'oneshot' }), [note(0, 120)]);   // 노트 길이 1/8 박(약 0.0625초)
check('D One-Shot: 아주 짧은 노트여도 샘플이 끝까지 울림 (1.5초 근처 소리)', (await E('window.__pk(1.4, 1.9)')) > 0.4, String(await E('window.__pk(1.4, 1.9)')));
check('D One-Shot: 샘플 길이(2초)가 지나면 조용함', (await E('window.__pk(2.1, 3)')) < 0.001, String(await E('window.__pk(2.1, 3)')));
await run(P({ mode: 'classic', release: 0.05 }), [note(0, 120)]);
check('D 같은 설정의 Classic 은 짧은 노트에서 일찍 끝남(대조)', (await E('window.__pk(0.5, 1.9)')) < 0.001, String(await E('window.__pk(0.5, 1.9)')));
await run(P({ mode: 'oneshot', loop: true, sustain: 0, release: 3 }), [note(0, 120)], { samples: { 1: { secs: 0.5, amp: 0.5, freq: 440 } } });
check('D One-Shot: Loop, Sustain, Release 를 무시하고 샘플 길이(0.5초)에서 끝남', (await E('window.__pk(0.1, 0.4)')) > 0.4 && (await E('window.__pk(0.6, 3)')) < 0.001, (await E('window.__pk(0.1, 0.4)')) + ' / ' + (await E('window.__pk(0.6, 3)')));
await run(P({ mode: 'oneshot', decay: 0.4 }), [note(0, 120)]);
check('D One-Shot + Decay 0.4초: 0.6초 뒤에는 조용함(꼬리를 줄임)', (await E('window.__pk(0.5, 1.9)')) < 0.001 && (await E('window.__pk(0.02, 0.1)')) > 0.3, (await E('window.__pk(0.5, 1.9)')) + ' / ' + (await E('window.__pk(0.02, 0.1)')));
await run(P({ mode: 'oneshot' }), [note(0, 120, 72)]);
check('D One-Shot 도 음높이를 따름: 880Hz, 샘플이 1초에 끝남', near(await E('window.__fq(0.1, 0.8)'), 880, 12) && (await E('window.__pk(1.1, 2)')) < 0.001, String(await E('window.__fq(0.1, 0.8)')));

// ── E. 겹쳐 울림 (연속으로 치면 앞의 소리를 끊지 않음)
await run(P({ mode: 'oneshot' }), [note(0, 120), note(960, 120)]);   // 0초와 0.5초에 같은 샘플
check('E 두 번째 노트가 시작해도 첫 번째가 이어서 울려 합쳐짐(0.5~1초 구간 피크 > 한 개일 때)', (await E('window.__pk(0.6, 0.9)')) > 0.7, String(await E('window.__pk(0.6, 0.9)')));
check('E 두 소리 모두 끝나는 2.5초 뒤에는 조용함', (await E('window.__pk(2.6, 3.5)')) < 0.001);

// ── F. 음량: velocity, gain, 악기 층 볼륨
await run(P({ gain: 0.5 }), [note(0, 960)]);
check('F gain 0.5: 피크가 절반(약 0.25)', near(await E('window.__pk(0.05, 0.45)'), 0.25, 0.02), String(await E('window.__pk(0.05, 0.45)')));
await run(P(), [note(0, 960, 60, 64)]);
check('F velocity 64: 피크가 약 0.5 × 64/127', near(await E('window.__pk(0.05, 0.45)'), 0.5 * 64 / 127, 0.02), String(await E('window.__pk(0.05, 0.45)')));

// ── G. 샘플이 없을 때
r = await R({ samples: {}, instruments: [{ params: P({ sample_id: null }) }], midiClips: [mclip([note(0, 960)])], start: 0, end: TPB });
check('G sample_id 가 없으면 오류 없이 조용함', !r.error && r.loads === 0 && (await E('window.__pk(0, 2)')) === 0, JSON.stringify(r));
r = await R({ samples: {}, instruments: [{ params: P({ sample_id: 5 }) }], midiClips: [mclip([note(0, 960)])], start: 0, end: TPB });
check('G 샘플을 불러오지 못해도(없는 번호) 렌더링은 끝나고 조용함', !r.error && r.loads === 1 && (await E('window.__pk(0, 2)')) === 0, JSON.stringify(r));

// ── H. 여러 층과 Synth 와의 공존
const synth = { osc1_wave: 'sine', osc1_level: 1, osc1_detune: 0, osc2_wave: 'sine', osc2_level: 0, osc2_detune: 0, osc2_semi: 0, cutoff: 20000, resonance: 0, filter_type: 'lowpass', env_attack: 0.005, env_decay: 0, env_sustain: 1, env_release: 0.05, lfo_depth: 0, lfo_rate: 1, lfo_target: 'off' };
r = await R({ samples: { 1: sine2 }, instruments: [{ params: P() }, { code: 'synth_sub', params: synth }], midiClips: [mclip([note(0, 960)])], start: 0, end: TPB });
check('H 한 트랙에 Sampler 와 Synth 가 함께 있으면 둘 다 울림(피크 > 한 개일 때)', (await E('window.__pk(0.05, 0.45)')) > 0.55, String(await E('window.__pk(0.05, 0.45)')));
r = await R({ samples: { 1: sine2 }, instruments: [{ params: P() }, { params: P() }], midiClips: [mclip([note(0, 960)])], start: 0, end: TPB });
check('H Sampler 두 층이 같은 샘플을 써도 샘플은 한 번만 불러옴', r.loads === 1, JSON.stringify(r));

process.exit(summary() ? 0 : 1);
