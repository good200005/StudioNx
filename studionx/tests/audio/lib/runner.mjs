// 오디오 회귀 테스트 실행 도구 (S1-12, PRD 00 §7.1)
// 하는 일: 정적 서버로 frontend 를 내주고, 헤드리스 Chrome 에서 앱의 renderOffline 으로 테스트 프로젝트를 렌더링해
//          채널별 Float32Array 로 받아 옵니다. 서버(FastAPI)나 DB 는 필요 없습니다.
// 프로젝트 JSON 은 마디와 박 단위로 읽기 쉽게 쓰고, 여기서 tick(PPQ 960) 단위의 앱 모양으로 바꿉니다.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPluginSchemas } from './plugins.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AUDIO_DIR = path.join(HERE, '..');
export const PROJECTS_DIR = path.join(AUDIO_DIR, 'projects');
export const GOLDEN_DIR = path.join(AUDIO_DIR, 'golden');
export const OUT_DIR = path.join(AUDIO_DIR, 'out');
const FRONTEND = path.join(HERE, '..', '..', '..', 'frontend');

/** 4/4 박자에서 1박 = 960 tick, 1마디 = 3840 tick (앱의 PPQ 와 같음) */
export const TICKS_PER_BEAT = 960;
export const TICKS_PER_BAR = 3840;

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json' };

/* ───────────────────────── 페이지 쪽 도구 ───────────────────────── */

// 시험용 소리(샘플)를 코드로 만들어 WAV 바이트로 바꾸고, 앱의 renderOffline 을 부릅니다.
// 샘플은 파일 없이 수식으로만 만들어서 저장소에 바이너리를 늘리지 않습니다 (같은 브라우저에서는 늘 같은 값).
const HARNESS = `<!doctype html><meta charset="utf-8"><title>audio regression harness</title>
<script type="module">
import { renderOffline } from '/static/js/audio/offline.js';
import { encodeWav } from '/static/js/audio/wav.js';

const SR = 44100;

function makeSample(spec) {
  const n = Math.round(SR * spec.secs);
  const d = new Float32Array(n);
  const amp = spec.amp == null ? 0.5 : spec.amp;
  const fade = Math.round(SR * (spec.fade == null ? 0.005 : spec.fade));
  let seed = (spec.seed == null ? 1 : spec.seed) >>> 0;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let x = 0;
    if (spec.kind === 'sine') {
      x = Math.sin(2 * Math.PI * spec.freq * t);
    } else if (spec.kind === 'saw') {
      for (let h = 1; h <= 12; h++) x += Math.sin(2 * Math.PI * spec.freq * h * t) / h;
      x *= 0.6;
    } else if (spec.kind === 'kick') {
      const f = (spec.f1 == null ? 45 : spec.f1) + ((spec.f0 == null ? 150 : spec.f0) - (spec.f1 == null ? 45 : spec.f1)) * Math.exp(-t / 0.03);
      phase += 2 * Math.PI * f / SR;
      x = Math.sin(phase) * Math.exp(-t / (spec.decay == null ? 0.12 : spec.decay));
    } else if (spec.kind === 'noise') {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      x = (seed / 4294967296 * 2 - 1) * Math.exp(-t / (spec.decay == null ? 0.05 : spec.decay));
    } else if (spec.kind === 'pluck') {
      x = (Math.sin(2 * Math.PI * spec.freq * t) + 0.5 * Math.sin(4 * Math.PI * spec.freq * t) + 0.25 * Math.sin(6 * Math.PI * spec.freq * t)) / 1.75
        * Math.exp(-t / (spec.decay == null ? 0.4 : spec.decay));
    }
    let env = 1;
    if (i < fade) env = i / fade;
    if (n - i <= fade) env = Math.min(env, (n - i) / fade);
    d[i] = amp * x * env;
  }
  return encodeWav([d], SR, 32, { gain: 1, dither: false }).buffer;
}

function toBase64(f32) {
  return new Promise(function (resolve) {
    const fr = new FileReader();
    fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
    fr.readAsDataURL(new Blob([f32.buffer.slice(f32.byteOffset, f32.byteOffset + f32.byteLength)]));
  });
}

window.__render = async function (a) {
  const bytes = {};
  Object.keys(a.samples).forEach(function (id) { bytes[id] = makeSample(a.samples[id]); });
  const out = await renderOffline({
    tracks: a.tracks, audioClips: a.audioClips, midiClips: a.midiClips,
    getInstruments: function (id) { return a.instruments[id] || []; },
    getEffects: function (id) { return a.effects[id] || []; },
    bpm: a.bpm, tempoChanges: a.tempoChanges, startTick: a.startTick, endTick: a.endTick,
    tailSec: a.tailSec, sampleRate: a.sampleRate,
    loadSampleBytes: function (id) { return Promise.resolve(bytes[id].slice(0)); },
  });
  const channels = [];
  for (const ch of out.channels) channels.push(await toBase64(ch));
  return { sampleRate: out.sampleRate, frames: out.frames, channels: channels };
};
window.__ready = true;
</script>`;

/* ───────────────────────── 서버와 브라우저 ───────────────────────── */

/** frontend 폴더를 내주는 정적 서버를 띄움 (빈 포트 사용) */
export function startServer() {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      if (url === '/__harness.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HARNESS);
        return;
      }
      const file = path.join(FRONTEND, url);
      if (file.indexOf(FRONTEND) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', function () { resolve({ server: server, port: server.address().port }); });
  });
}

/** 헤드리스 Chrome 을 띄워 DevTools 로 연결 */
async function launchChrome() {
  const exe = process.env.BROWSER_PATH || process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (!fs.existsSync(exe)) throw new Error('Chrome 을 찾지 못했습니다: ' + exe + ' (환경 변수 BROWSER_PATH 로 지정할 수 있습니다)');
  const port = 9600 + Math.floor(Math.random() * 300);
  const dir = path.join(os.tmpdir(), 'studionx_audio_regression_' + port);
  fs.rmSync(dir, { recursive: true, force: true });
  const chrome = spawn(exe, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await new Promise(function (r) { setTimeout(r, 250); });
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      target = list.filter(function (x) { return x.type === 'page'; })[0] || null;
    } catch (e) { /* 아직 안 떴음 */ }
  }
  if (!target) { chrome.kill(); throw new Error('Chrome 에 연결하지 못했습니다'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function (r) { ws.addEventListener('open', r); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', function (e) {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  });
  const send = function (method, params) {
    return new Promise(function (r) { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: method, params: params || {} })); });
  };
  await send('Page.enable');
  await send('Runtime.enable');
  const version = (await send('Browser.getVersion')).result.product;
  return {
    send: send,
    version: version,
    close: function () {
      try { ws.close(); } catch (e) { /* 무시 */ }
      chrome.kill();
      // Chrome 이 아직 파일을 잡고 있을 수 있어서, 임시 폴더 지우기는 실패해도 넘어갑니다 (다음 실행이 지우고 시작)
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 무시 */ }
    },
  };
}

/**
 * 서버와 브라우저를 띄우고 하니스 페이지를 열어, 프로젝트를 렌더링하는 함수를 돌려줌
 * @returns {Promise<{render:function(object):Promise<{channels:Float32Array[], sampleRate:number, frames:number}>, version:string, close:function():void}>}
 */
export async function openRenderer() {
  const srv = await startServer();
  const browser = await launchChrome();
  await browser.send('Page.navigate', { url: 'http://127.0.0.1:' + srv.port + '/__harness.html' });
  for (let i = 0; i < 80; i++) {
    const r = await browser.send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true });
    if (r.result && r.result.result && r.result.result.value === true) break;
    await new Promise(function (res) { setTimeout(res, 150); });
    if (i === 79) { browser.close(); srv.server.close(); throw new Error('하니스 페이지가 준비되지 않았습니다'); }
  }
  return {
    version: browser.version,
    render: async function (args) {
      const r = await browser.send('Runtime.evaluate', {
        expression: 'window.__render(' + JSON.stringify(args) + ')',
        awaitPromise: true, returnByValue: true,
      });
      if (r.result && r.result.exceptionDetails) {
        const d = r.result.exceptionDetails;
        throw new Error('렌더링 실패: ' + (d.exception && d.exception.description ? d.exception.description : d.text));
      }
      const v = r.result.result.value;
      const channels = v.channels.map(function (b64) {
        const buf = Buffer.from(b64, 'base64');
        return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      });
      return { channels: channels, sampleRate: v.sampleRate, frames: v.frames };
    },
    close: function () { browser.close(); srv.server.close(); },
  };
}

/* ───────────────────────── 프로젝트 JSON → 렌더링 인자 ───────────────────────── */

/** 프로젝트 JSON 파일 읽기 (이름순) */
export function loadProjects(only) {
  return fs.readdirSync(PROJECTS_DIR)
    .filter(function (f) { return f.endsWith('.json'); })
    .sort()
    .map(function (f) { return JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8')); })
    .filter(function (p) { return !only || only.indexOf(p.name) >= 0; });
}

/**
 * 프로젝트 JSON(마디와 박 단위)을 앱의 renderOffline 이 받는 모양(tick 단위)으로 바꿈
 * @param {object} p  프로젝트 JSON
 * @param {Object<string,Array>} [schemas]  플러그인 code → param_schema (없으면 시드에서 읽음)
 */
export function buildArgs(p, schemas) {
  const sch = schemas || loadPluginSchemas();
  const need = function (code) {
    if (!sch[code]) throw new Error('프로젝트 ' + p.name + ': 알 수 없는 플러그인 ' + code);
    return sch[code];
  };
  const tracks = (p.tracks || []).map(function (t) {
    return { track_id: t.id, track_type: t.type, volume_db: t.volume_db || 0, pan: t.pan || 0, is_muted: !!t.mute, is_solo: !!t.solo };
  });
  if (!tracks.some(function (t) { return t.track_type === 'MASTER'; })) tracks.push({ track_id: 999, track_type: 'MASTER', volume_db: p.master_db || 0, pan: 0, is_muted: false, is_solo: false });

  const instruments = {};
  Object.keys(p.instruments || {}).forEach(function (tid) {
    instruments[tid] = p.instruments[tid].map(function (l, i) {
      return { id: Number(tid) * 100 + i + 1, plugin_code: l.plugin, schema: need(l.plugin), params: l.params || {}, volume_db: l.volume_db || 0, pan: l.pan || 0, is_enabled: l.enabled !== false };
    });
  });
  const effects = {};
  Object.keys(p.effects || {}).forEach(function (tid) {
    effects[tid] = p.effects[tid].map(function (e, i) {
      return { id: Number(tid) * 100 + i + 1, plugin_code: e.plugin, schema: need(e.plugin), params: e.params || {}, is_bypassed: !!e.bypass, slot_index: i };
    });
  });
  const audioClips = (p.audioClips || []).map(function (c, i) {
    return {
      clip_id: i + 1, track_id: c.track, sample_id: c.sample,
      start_tick: Math.round(c.startBar * TICKS_PER_BAR), length_tick: Math.round(c.lengthBars * TICKS_PER_BAR),
      offset_tick: Math.round((c.offsetBars || 0) * TICKS_PER_BAR), gain_db: c.gain_db || 0, is_looped: !!c.loop, pitch_semitones: c.pitch || 0,
    };
  });
  const midiClips = (p.midiClips || []).map(function (c) {
    return {
      track_id: c.track, start_tick: Math.round(c.startBar * TICKS_PER_BAR), length_tick: Math.round(c.lengthBars * TICKS_PER_BAR), offset_tick: 0,
      notes: c.notes.map(function (n) {
        return { pitch: n.pitch, velocity: n.velocity == null ? 100 : n.velocity, start_tick: Math.round(n.startBeat * TICKS_PER_BEAT), length_tick: Math.round(n.lengthBeat * TICKS_PER_BEAT) };
      }),
    };
  });
  return {
    samples: p.samples || {}, tracks: tracks, instruments: instruments, effects: effects, audioClips: audioClips, midiClips: midiClips,
    bpm: p.bpm || 120,
    tempoChanges: (p.tempoChanges || []).map(function (c) { return { tick: Math.round(c.bar * TICKS_PER_BAR), bpm: c.bpm, ramp: c.ramp || 'STEP' }; }),
    startTick: Math.round((p.startBar || 0) * TICKS_PER_BAR),
    endTick: Math.round(p.endBar * TICKS_PER_BAR), tailSec: p.tailSec || 0, sampleRate: p.sampleRate || 44100,
  };
}

/** 골든 파일 경로 */
export function goldenPath(name) {
  return path.join(GOLDEN_DIR, name + '.wav');
}
