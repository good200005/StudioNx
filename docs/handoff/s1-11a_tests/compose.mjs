// S1-11a 동영상 합치기 — record.mjs 가 저장한 프레임(cap.json)과 소리를 한 동영상 파일로 만듭니다 (ffmpeg 없이 Chrome 만 사용).
// 작은 HTTP 서버가 cap.json 과 합치기 페이지를 내주고, 페이지가 만든 동영상을 받아 파일로 저장합니다.
// 실행: node docs/handoff/s1-11a_tests/compose.mjs
import fs from 'node:fs';
import http from 'node:http';
import { launch } from '../p1-28_tests/lib.mjs';

const SCRATCH = process.env.REC_SCRATCH || 'C:/Users/USER/AppData/Local/Temp/rec_s111a/';
const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-11a_audio_graph/';
const PORT = 9590;
fs.mkdirSync(OUT, { recursive: true });

const PAGE = `<!doctype html><meta charset="utf-8"><title>compose</title><body>
<script>
window.run = async function () {
  const cap = await (await fetch('/cap.json')).json();
  const frames = cap.frames, t0 = frames[0].t;
  const times = frames.map(f => f.t - t0);
  const offset = cap.audioStart - t0;
  const bitmaps = await Promise.all(frames.map(async f => {
    const bin = atob(f.data); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
  }));
  const w = bitmaps[0].width, h = bitmaps[0].height;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  const ctx = new AudioContext(); await ctx.resume();
  const abin = atob(cap.audioB64); const au = new Uint8Array(abin.length);
  for (let i = 0; i < abin.length; i++) au[i] = abin.charCodeAt(i);
  const abuf = await ctx.decodeAudioData(au.buffer);
  const dest = ctx.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
  const chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const total = times[times.length - 1] + 600;
  g.drawImage(bitmaps[0], 0, 0);
  const src = ctx.createBufferSource(); src.buffer = abuf; src.connect(dest);
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(250);
  const start = performance.now();
  if (offset >= 0) src.start(ctx.currentTime + offset / 1000); else src.start(ctx.currentTime, -offset / 1000);
  let idx = 0;
  await new Promise(res => {
    const tick = () => {
      const t = performance.now() - start;
      while (idx + 1 < times.length && times[idx + 1] <= t) idx++;
      g.drawImage(bitmaps[idx], 0, 0);
      if (t < total) requestAnimationFrame(tick); else res();
    };
    tick();
  });
  rec.stop(); await stopped;
  const blob = new Blob(chunks, { type: mime });
  const ext = mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
  await fetch('/out?ext=' + ext, { method: 'POST', body: blob });
  return JSON.stringify({ mime, w, h, seconds: total / 1000, frames: frames.length, size: blob.size, ext });
};
</script>`;

let saved = null;
const server = http.createServer((req, res) => {
  if (req.url === '/compose.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(PAGE); return; }
  if (req.url === '/cap.json') { res.setHeader('Content-Type', 'application/json'); fs.createReadStream(SCRATCH + 'cap.json').pipe(res); return; }
  if (req.url.startsWith('/out') && req.method === 'POST') {
    const ext = req.url.indexOf('ext=mp4') >= 0 ? 'mp4' : 'webm';
    const file = OUT + 's1-11a_playback.' + ext;
    const ws = fs.createWriteStream(file);
    req.pipe(ws);
    ws.on('finish', () => { saved = file; res.end('ok'); });
    return;
  }
  res.statusCode = 404; res.end();
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const b = await launch(9591, 1280, 800);
await b.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/compose.html` });
await b.sleep(1500);
const info = await b.ev('run()');
console.log('info', info);
b.close();
server.close();
if (saved) console.log('saved', saved, Math.round(fs.statSync(saved).size / 1024) + 'KB');
else console.log('NOT SAVED');
process.exit(saved ? 0 : 1);
