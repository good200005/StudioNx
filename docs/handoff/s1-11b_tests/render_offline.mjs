// S1-11b 오프라인 렌더링 시험 — 실제 OfflineAudioContext 로 클립 · 노트 · 이펙트 · 믹서를 그려 소리를 숫자로 확인합니다.
// 화면 · 로그인은 필요 없고, 서버 8001 이 static 파일을 내주는 것만 필요합니다.
// 실행: node docs/handoff/s1-11b_tests/render_offline.mjs
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const b = await launch(9571, 800, 600);
await b.goto('http://localhost:8001/home.html');

await b.ev(`(async () => {
  const wav = await import('/static/js/audio/wav.js');
  const off = await import('/static/js/audio/offline.js');
  const schemaOf = (p) => Object.keys(p).map((k) => ({ key: k, default: p[k] }));
  window.__wav = wav;

  // 시험용 소리: 사인파(앞쪽 silent 초는 무음)를 WAV 바이트로 만들어 줌
  const makeSamples = (samples) => {
    const bytes = {};
    Object.keys(samples || {}).forEach((id) => {
      const s = samples[id], n = Math.round(44100 * s.secs), d = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / 44100; d[i] = t < (s.silent || 0) || t >= (s.until || 1e9) ? 0 : s.amp * Math.sin(2 * Math.PI * s.freq * t); }
      bytes[id] = wav.encodeWav([d], 44100, 16, { dither: false }).buffer;
    });
    return bytes;
  };

  window.__r = async (cfg) => {
    const bytes = makeSamples(cfg.samples);
    const tracks = cfg.tracks || [{ track_id: 1, track_type: 'AUDIO', volume_db: 0, pan: 0, is_muted: false, is_solo: false }, { track_id: 99, track_type: 'MASTER', volume_db: 0 }];
    const fx = cfg.effects || {}, ins = cfg.instruments || {};
    const progress = [];
    let calls = 0;
    try {
      const out = await off.renderOffline({
        tracks, audioClips: cfg.audioClips || [], midiClips: cfg.midiClips || [],
        getInstruments: (id) => (ins[id] || []).map((l, i) => ({ id: i + 1, plugin_code: 'synth_sub', schema: schemaOf(l.params), params: l.params, volume_db: 0, pan: 0, is_enabled: true })),
        getEffects: (id) => (fx[id] || []).map((e, i) => ({ id: 'e' + id + '_' + i, plugin_code: e.code, schema: schemaOf(e.params), params: e.params, is_bypassed: false, slot_index: i })),
        bpm: cfg.bpm || 120, tempoChanges: cfg.tempoChanges || [],
        startTick: cfg.start, endTick: cfg.end, tailSec: cfg.tail || 0, sampleRate: cfg.sampleRate || 44100,
        loadSampleBytes: (id) => Promise.resolve(bytes[id].slice(0)),
        onProgress: (p) => { progress.push(p); calls++; },
        isCancelled: () => cfg.cancelAfter != null && calls >= cfg.cancelAfter,
      });
      window.__last = out;
      return { frames: out.frames, sampleRate: out.sampleRate, channels: out.channels.length, progress };
    } catch (e) { return { error: e.message, progress }; }
  };

  const sl = (ch, t0, t1) => { const sr = window.__last.sampleRate, d = window.__last.channels[ch]; return d.subarray(Math.max(0, Math.floor(t0 * sr)), Math.min(d.length, Math.floor(t1 * sr))); };
  window.__pk = (t0, t1, ch) => { const d = sl(ch || 0, t0, t1); let p = 0; for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); return p; };
  window.__en = (t0, t1) => { const d = sl(0, t0, t1); let e = 0; for (let i = 0; i < d.length; i++) e += d[i] * d[i]; return e; };
  window.__fq = (t0, t1) => { const d = sl(0, t0, t1); let n = 0; for (let i = 1; i < d.length; i++) if (d[i - 1] <= 0 && d[i] > 0) n++; return n / (t1 - t0); };
  window.__minBlock = (t0, t1, step) => { let m = 1e9; for (let t = t0; t + step <= t1 + 1e-9; t += step) m = Math.min(m, window.__pk(t, t + step, 0)); return m; };
  window.__roundtrip = async (depth, gain) => {
    const o = window.__last;
    const bytes = wav.encodeWav(o.channels, o.sampleRate, depth, { gain: gain || 1 });
    const ctx = new OfflineAudioContext(2, 1, o.sampleRate);
    const buf = await ctx.decodeAudioData(bytes.buffer.slice(0));
    let peak = 0, maxDiff = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const a = buf.getChannelData(c), s = o.channels[c]; for (let i = 0; i < a.length; i++) { peak = Math.max(peak, Math.abs(a[i])); maxDiff = Math.max(maxDiff, Math.abs(a[i] - s[i] * (gain || 1))); } }
    return { length: buf.length, sampleRate: buf.sampleRate, channels: buf.numberOfChannels, peak, maxDiff, bytes: bytes.length, expect: wav.wavByteLength(o.frames, 2, depth) };
  };
  window.__srcPeak = () => wav.peakOfChannels(window.__last.channels);
  window.__gainFor = (db) => wav.normalizeGain(wav.peakOfChannels(window.__last.channels), db);
  return 1;
})()`);

const R = (cfg) => b.ev('window.__r(' + JSON.stringify(cfg) + ')');
const E = (expr) => b.ev(expr);
const near = (x, y, tol) => Math.abs(x - y) <= tol;
const clip = (o) => Object.assign({ track_id: 1, sample_id: 1, start_tick: 0, length_tick: 3840, offset_tick: 0, gain_db: 0, is_looped: false, pitch_semitones: 0 }, o || {});
const sine = { secs: 2, amp: 0.5, freq: 440 };
const TPB = 3840;   // 120BPM 에서 1마디 = 2초

// ── A. 기본 클립
let r = await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB });
check('A 길이: 2초 × 44100 = 88200 프레임, 스테레오', r.frames === 88200 && r.channels === 2 && r.sampleRate === 44100, JSON.stringify(r));
let pkL = await E('window.__pk(0.2, 1.8, 0)'), pkR = await E('window.__pk(0.2, 1.8, 1)');
check('A 소리: 피크가 약 0.5', near(pkL, 0.5, 0.03), 'L=' + pkL);
check('A 모노 샘플이 좌우에 같게', near(pkL, pkR, 0.01), pkL + ' / ' + pkR);
check('A 높이: 440Hz', near(await E('window.__fq(0.2, 1.2)'), 440, 5));

// ── B. 뮤트 · 솔로 · 볼륨 · 팬 · 마스터
const T = (o) => Object.assign({ track_id: 1, track_type: 'AUDIO', volume_db: 0, pan: 0, is_muted: false, is_solo: false }, o || {});
const M = (o) => Object.assign({ track_id: 99, track_type: 'MASTER', volume_db: 0 }, o || {});
await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB, tracks: [T({ is_muted: true }), M()] });
check('B 뮤트한 트랙은 처음부터 끝까지 완전한 무음 (렌더링 시작 때 새지 않음)', (await E('window.__srcPeak()')) === 0, await E('window.__srcPeak()'));
await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB, tracks: [T({ volume_db: -6 }), M()] });
check('B 트랙 볼륨 -6dB: 피크가 약 절반 (0.25)', near(await E('window.__pk(0.2, 1.8, 0)'), 0.25, 0.02));
await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB, tracks: [T(), M({ volume_db: -6 })] });
check('B 마스터 볼륨 -6dB: 피크가 약 절반', near(await E('window.__pk(0.2, 1.8, 0)'), 0.25, 0.02));
await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB, tracks: [T({ pan: -1 }), M()] });
check('B 팬 왼쪽 끝: 오른쪽은 무음, 왼쪽은 소리', (await E('window.__pk(0.2, 1.8, 1)')) < 0.001 && (await E('window.__pk(0.2, 1.8, 0)')) > 0.4);
await R({
  samples: { 1: sine, 2: { secs: 2, amp: 0.5, freq: 880 } },
  audioClips: [clip(), clip({ track_id: 2, sample_id: 2 })], start: 0, end: TPB,
  tracks: [T(), T({ track_id: 2, is_solo: true }), M()],
});
check('B 솔로: 솔로 트랙(880Hz)만 들림', near(await E('window.__fq(0.2, 1.2)'), 880, 8), await E('window.__fq(0.2, 1.2)'));

// ── C. 샘플레이트
r = await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB, sampleRate: 48000 });
check('C 48kHz: 96000 프레임, 샘플레이트 48000', r.frames === 96000 && r.sampleRate === 48000, JSON.stringify(r));
check('C 48kHz 에서도 높이 440Hz (샘플이 다시 맞춰져도 음정이 같음)', near(await E('window.__fq(0.2, 1.2)'), 440, 5));

// ── D. 범위: 시작 · 끝 · 꼬리
const long = { secs: 4, silent: 1, amp: 0.5, freq: 440 };
r = await R({ samples: { 1: long }, audioClips: [clip({ length_tick: TPB * 2 })], start: 0, end: TPB * 2 });
check('D 처음부터: 1초는 무음, 그 뒤 소리', (await E('window.__pk(0.05, 0.95, 0)')) < 0.001 && (await E('window.__pk(1.25, 1.75, 0)')) > 0.45);
r = await R({ samples: { 1: long }, audioClips: [clip({ length_tick: TPB * 2 })], start: 1920, end: TPB * 2 });
check('D 1초 지점부터 내보내기: 길이 3초이고 처음부터 소리 (클립 중간부터 울림)', r.frames === 3 * 44100 && (await E('window.__pk(0.0, 0.25, 0)')) > 0.45, JSON.stringify(r) + ' pk=' + await E('window.__pk(0.0, 0.25, 0)'));
r = await R({ samples: { 1: { secs: 4, amp: 0.5, freq: 440 } }, audioClips: [clip({ length_tick: TPB * 2 })], start: 0, end: TPB, tail: 1 });
check('D 끝 + 꼬리 1초: 3초 길이', r.frames === 3 * 44100, r.frames);
check('D 범위 끝(2초)에서 소리가 잘림: 그 전은 소리, 꼬리 구간은 무음', (await E('window.__pk(1.75, 1.99, 0)')) > 0.45 && (await E('window.__pk(2.05, 3.0, 0)')) < 0.001);
r = await R({ samples: { 1: sine }, audioClips: [clip({ start_tick: 1920, length_tick: 1920 })], start: 0, end: TPB });
check('D 범위 안에서 시작하는 클립: 1초는 무음, 그 뒤 소리', (await E('window.__pk(0.05, 0.95, 0)')) < 0.001 && (await E('window.__pk(1.1, 1.9, 0)')) > 0.45);
r = await R({ samples: { 1: sine }, audioClips: [clip({ start_tick: TPB * 5 })], start: 0, end: TPB });
check('D 범위 밖의 클립은 소리 없음', (await E('window.__srcPeak()')) === 0);

// ── E. Synth 노트
const synth = { osc1_wave: 'saw', osc1_level: 1, osc1_detune: 0, osc2_wave: 'saw', osc2_level: 0, osc2_detune: 0, osc2_semi: 0, cutoff: 20000, resonance: 0, filter_type: 'lowpass', env_attack: 0.005, env_decay: 0, env_sustain: 1, env_release: 0.2, lfo_depth: 0, lfo_rate: 1, lfo_target: 'off' };
const note = (tick, len, pitch) => ({ pitch: pitch || 60, velocity: 127, start_tick: tick, length_tick: len });
const mclip = (notes, o) => Object.assign({ track_id: 1, start_tick: 0, length_tick: TPB * 3, offset_tick: 0, notes }, o || {});
r = await R({ instruments: { 1: [{ params: synth }] }, midiClips: [mclip([note(0, 960)])], start: 0, end: TPB, tail: 1 });
check('E 노트: 울리는 동안 소리가 남', (await E('window.__pk(0.1, 0.4, 0)')) > 0.1, await E('window.__pk(0.1, 0.4, 0)'));
check('E 노트 높이: C4 = 261.6Hz', near(await E('window.__fq(0.1, 0.45)'), 261.6, 8), await E('window.__fq(0.1, 0.45)'));
check('E 노트가 끝나고 릴리스(0.2초)가 지나면 무음', (await E('window.__pk(1.0, 3.0, 0)')) < 0.001, await E('window.__pk(1.0, 3.0, 0)'));
r = await R({ instruments: { 1: [{ params: synth }] }, midiClips: [mclip([note(0, 960), note(TPB, 960), note(TPB * 2, 960)], { length_tick: TPB * 3 })], start: 0, end: TPB * 3 });
check('E 여러 시간 창에 걸친 노트(0 · 2 · 4초): 모두 울림', (await E('window.__pk(0.1, 0.4, 0)')) > 0.1 && (await E('window.__pk(2.1, 2.4, 0)')) > 0.1 && (await E('window.__pk(4.1, 4.4, 0)')) > 0.1);
check('E 노트 사이는 무음 (1.2 · 3.2 · 5.2초)', (await E('window.__pk(1.2, 1.9, 0)')) < 0.001 && (await E('window.__pk(3.2, 3.9, 0)')) < 0.001);
r = await R({ instruments: { 1: [{ params: synth }] }, midiClips: [mclip([note(TPB, 960)])], start: TPB, end: TPB * 2 });
check('E 범위 시작이 노트 시작과 같으면 처음부터 울림', (await E('window.__pk(0.05, 0.4, 0)')) > 0.1);
r = await R({ instruments: { 1: [{ params: synth }] }, midiClips: [mclip([note(0, 960)])], start: 480, end: TPB });
check('E 범위 시작 전에 시작한 노트는 울리지 않음 (재생과 같은 규칙)', (await E('window.__srcPeak()')) === 0);
r = await R({ instruments: { 1: [{ params: synth }] }, midiClips: [mclip([note(0, 960 * 8)])], start: 0, end: TPB });
check('E 범위 끝을 넘어가는 노트는 끝에서 잘림 (꼬리 구간은 릴리스 후 무음)', (await E('window.__pk(1.9, 1.99, 0)')) > 0.1, await E('window.__pk(1.9, 1.99, 0)'));

// ── F. 시간 창 경계에서 끊김이 없는지
r = await R({ samples: { 1: { secs: 12, amp: 0.5, freq: 440 } }, audioClips: [clip({ length_tick: TPB * 6 })], start: 0, end: TPB * 6 });
check('F 12초 클립: 모든 0.1초 구간에 소리가 있음 (2초 창 경계에서 끊김 없음)', (await E('window.__minBlock(0.1, 11.9, 0.1)')) > 0.4, await E('window.__minBlock(0.1, 11.9, 0.1)'));

// ── G. 진행률 · 취소
r = await R({ samples: { 1: { secs: 12, amp: 0.5, freq: 440 } }, audioClips: [clip({ length_tick: TPB * 6 })], start: 0, end: TPB * 6 });
const pr = r.progress;
check('G 진행률: 여러 번 알려 줌 (시간 창마다)', pr.length >= 5, pr.length);
check('G 진행률: 줄어들지 않고 마지막은 1', pr.every((x, i) => i === 0 || x >= pr[i - 1]) && pr[pr.length - 1] === 1, JSON.stringify(pr));
check('G 진행률: 0~1 사이', pr.every((x) => x >= 0 && x <= 1));
r = await R({ samples: { 1: { secs: 12, amp: 0.5, freq: 440 } }, audioClips: [clip({ length_tick: TPB * 6 })], start: 0, end: TPB * 6, cancelAfter: 3 });
check('G 취소하면 "cancelled" 오류로 끝남', r.error === 'cancelled', JSON.stringify(r));

// ── H. 이펙트 꼬리
const burst = { secs: 0.2, amp: 0.5, freq: 440 };
const delayP = { time: 0.3, sync: false, division: '1/8', feedback: 0.5, tone: 1, mix: 0.5 };
r = await R({ samples: { 1: burst }, audioClips: [clip({ length_tick: 960 })], effects: { 1: [{ code: 'delay', params: delayP }] }, start: 0, end: 960, tail: 3 });
const echo = await E('window.__en(0.6, 3.0)');
check('H 딜레이 + 꼬리 3초: 범위 끝(0.5초) 뒤에 반복음이 남음', echo > 1e-3, 'energy=' + echo);
await R({ samples: { 1: burst }, audioClips: [clip({ length_tick: 960 })], start: 0, end: 960, tail: 3 });
check('H 이펙트가 없으면 꼬리 구간은 무음', (await E('window.__en(0.6, 3.0)')) < 1e-9);
r = await R({ samples: { 1: burst }, audioClips: [clip({ length_tick: 960 })], effects: { 1: [{ code: 'reverb', params: { decay: 2, damping: 0.5, pre_delay: 0.02, mix: 0.5 } }] }, start: 0, end: 960, tail: 2.5 });
check('H 리버브 꼬리: 범위 끝 뒤에도 잔향이 남음', (await E('window.__en(0.6, 1.5)')) > 1e-4, await E('window.__en(0.6, 1.5)'));

// ── I. 템포
r = await R({ samples: { 1: sine }, audioClips: [clip({ length_tick: 1920 })], bpm: 60, start: 0, end: 1920 });
check('I 60BPM: 1920tick = 2초', r.frames === 88200, r.frames);
r = await R({ samples: { 1: sine }, audioClips: [clip()], bpm: 120, tempoChanges: [{ tick: 1920, bpm: 240 }], start: 0, end: TPB });
check('I 템포 변경: 1초(120BPM, 1920tick) + 0.5초(240BPM, 1920tick) = 1.5초', near(r.frames / 44100, 1.5, 0.01), r.frames / 44100);

// ── J. WAV 로 내보낸 뒤 브라우저가 다시 읽어서 같은 소리인지
await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB });
const frames = 88200;
for (const depth of [16, 24, 32]) {
  const rt = await E('window.__roundtrip(' + depth + ')');
  check('J WAV ' + depth + 'bit: 브라우저가 읽을 수 있음 (길이 · 샘플레이트 · 채널)', rt.length === frames && rt.sampleRate === 44100 && rt.channels === 2, JSON.stringify(rt));
  check('J WAV ' + depth + 'bit: 파일 크기가 계산과 같음', rt.bytes === rt.expect, rt.bytes + ' / ' + rt.expect);
  const tol = depth === 16 ? 2e-4 : depth === 24 ? 1e-6 : 1e-9;
  check('J WAV ' + depth + 'bit: 읽은 값이 렌더링과 거의 같음 (최대 차이 ' + tol + ')', rt.maxDiff <= tol, 'maxDiff=' + rt.maxDiff);
}
const g = await E('window.__gainFor(-0.3)');
const nrt = await E('window.__roundtrip(24, ' + g + ')');
check('J 정규화: 피크가 -0.3dBFS (0.966) 가 됨', near(nrt.peak, Math.pow(10, -0.3 / 20), 0.002), 'peak=' + nrt.peak);
const src2 = await R({ samples: { 1: sine }, audioClips: [clip()], start: 0, end: TPB, sampleRate: 48000 });
const rt48 = await E('window.__roundtrip(16)');
check('J 48kHz WAV 도 읽힘', rt48.length === 96000 && rt48.sampleRate === 48000, JSON.stringify(rt48));

await b.close();
process.exit(summary() ? 0 : 1);
