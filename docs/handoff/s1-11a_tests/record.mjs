// S1-11a 동영상 녹화 — 재생, 뮤트, 정지 장면을 화면과 소리가 함께 담긴 파일로 만듭니다 (ffmpeg 없이 Chrome 만 사용).
// 방법: ① 스튜디오 화면의 CDP 스크린캐스트 프레임을 모으고, 마스터 출력을 MediaRecorder 로 녹음합니다.
//       ② 다른 페이지에서 프레임을 캔버스에 시간 순서대로 그리고, 녹음을 함께 재생하며 다시 MediaRecorder 로 한 파일에 담습니다.
// 전제: 시험용 서버 8001, 계정 s109-tester@example.com, 프로젝트 14431. 끝나면 만든 클립과 샘플을 지웁니다.
// 실행: node docs/handoff/s1-11a_tests/record.mjs
import fs from 'node:fs';
import { launch } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-11a_audio_graph/';
const BASE = 'http://localhost:8001';
const PID = '14431';
const J = (v) => JSON.stringify(v);
const SCRATCH = process.env.REC_SCRATCH || 'C:/Users/USER/AppData/Local/Temp/rec_s111a/';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9581, 1280, 800);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);
const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);

await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
await q(`fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'}).then(r=>r.status)`);

// 씨앗: 8초짜리 440Hz 사인파를 오디오 트랙에 4마디 클립으로
const seed = JSON.parse(await api(`
  const full = await m.api.get('/projects/${PID}/full');
  for (const c of full.clips) { await m.api.delete('/clips/' + c.clip_id); }
  let audio = full.tracks.filter(t => t.track_type === 'AUDIO')[0];
  if (!audio) audio = await m.api.post('/projects/${PID}/tracks', { name: 'S1-11a Audio', track_type: 'AUDIO' });
  const sr = 44100, n = sr * 8, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 0.4 * 32767), true);
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'audio/wav' }), 's1-11a-sine440.wav');
  const sample = await m.api.post('/samples', fd);
  const clip = await m.api.post('/tracks/' + audio.track_id + '/clips', { clip_type: 'AUDIO', sample_id: sample.sample_id, start_tick: 0, length_tick: 3840 * 4 });
  return JSON.stringify({ trackId: audio.track_id, sampleId: sample.sample_id, clipId: clip.clip_id });
`));

// 열기 (재생선을 0마디로)
await b.send('Page.navigate', { url: `${BASE}/studioNx.html?projectId=${PID}` });
await sleep(3500);
await q(`document.getElementById('btn-stop').click()`);
await sleep(400);

/* ── ① 프레임 모으기 + 소리 녹음 ── */
const frames = [];
let capturing = true;
await b.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
let seen = b.events.length;
const pump = (async () => {
  while (capturing) {
    for (; seen < b.events.length; seen++) {
      const e = b.events[seen];
      if (e.method === 'Page.screencastFrame') {
        frames.push({ t: Date.now(), data: e.params.data });
        b.send('Page.screencastFrameAck', { sessionId: e.params.sessionId });
      }
    }
    await sleep(30);
  }
})();

await q(`document.getElementById('btn-play').click()`);
await sleep(600);                                   // 세션이 만들어질 때까지
const audioStart = await q(`(async()=>{const m=await import('/static/js/pages/sequencer-audio.js');const s=m.audioSession();
  const dest=s.mixer.context.createMediaStreamDestination();s.mixer.master.connect(dest);
  window.__chunks=[];window.__rec=new MediaRecorder(dest.stream);window.__rec.ondataavailable=e=>window.__chunks.push(e.data);
  window.__rec.start();return Date.now()})()`);
await sleep(2500);
const mute = `document.querySelector('.sq-track[data-track-id="${seed.trackId}"] .is-mute').click()`;
await q(mute); await sleep(1500);                   // 뮤트: 소리가 사라짐
await q(mute); await sleep(2000);                   // 해제: 소리가 돌아옴
await q(`document.getElementById('btn-stop').click()`);
await sleep(1200);
const audioB64 = await q(`(async()=>{window.__rec.stop();await new Promise(r=>setTimeout(r,300));
  const blob=new Blob(window.__chunks,{type:window.__rec.mimeType});const buf=new Uint8Array(await blob.arrayBuffer());
  let s='';for(let i=0;i<buf.length;i+=32768)s+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));return btoa(s)})()`);
capturing = false; await pump;
await b.send('Page.stopScreencast');
fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(SCRATCH + 'cap.json', J({ audioStart, audioB64, frames }));
console.log('frames', frames.length, 'audio KB', Math.round(audioB64.length * 0.75 / 1024));

// 씨앗 지우기
await api(`await m.api.delete('/clips/${seed.clipId}'); await m.api.delete('/samples/${seed.sampleId}');`);

/* ── ② 합치기 ── */
await b.send('Page.navigate', { url: `${BASE}/home.html` });
await sleep(2000);
console.log('compose: start');
const t0 = frames[0].t;
const meta = J({ times: frames.map((f) => f.t - t0), audioOffset: audioStart - t0 });
await q(`window.__frames=[];undefined`);
for (let i = 0; i < frames.length; i += 20) {
  await q(`window.__frames.push(...${J(frames.slice(i, i + 20).map((f) => f.data))});undefined`);
}
console.log('compose: frames sent');
await q(`window.__meta=${meta};undefined`);
await q(`window.__audio='${audioB64}';undefined`);
console.log('compose: audio sent');
const result = await q(`(async()=>{
  const times=window.__meta.times, offset=window.__meta.audioOffset;
  const bitmaps=await Promise.all(window.__frames.map(async d=>{const bin=atob(d);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return createImageBitmap(new Blob([u],{type:'image/jpeg'}))}));
  const w=bitmaps[0].width,h=bitmaps[0].height;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const g=canvas.getContext('2d');
  const ctx=new AudioContext();await ctx.resume();
  const abin=atob(window.__audio);const au=new Uint8Array(abin.length);for(let i=0;i<abin.length;i++)au[i]=abin.charCodeAt(i);
  const abuf=await ctx.decodeAudioData(au.buffer);
  const dest=ctx.createMediaStreamDestination();
  const stream=new MediaStream([...canvas.captureStream(30).getVideoTracks(),...dest.stream.getAudioTracks()]);
  const mime=['video/mp4;codecs=avc1,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});const chunks=[];rec.ondataavailable=e=>chunks.push(e.data);
  const total=times[times.length-1]+600;
  const start=performance.now();
  rec.start();
  if(offset>=0){const src=ctx.createBufferSource();src.buffer=abuf;src.connect(dest);src.start(ctx.currentTime+offset/1000);}
  else{const src=ctx.createBufferSource();src.buffer=abuf;src.connect(dest);src.start(ctx.currentTime,-offset/1000);}
  let idx=0;
  await new Promise(res=>{const tick=()=>{const t=performance.now()-start;while(idx+1<times.length&&times[idx+1]<=t)idx++;g.drawImage(bitmaps[idx],0,0);if(t<total)requestAnimationFrame(tick);else res();};tick();});
  rec.stop();await new Promise(r=>rec.onstop=r);
  const blob=new Blob(chunks,{type:mime});const buf=new Uint8Array(await blob.arrayBuffer());
  let s='';for(let i=0;i<buf.length;i+=32768)s+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));
  return JSON.stringify({mime,w,h,seconds:total/1000,b64:btoa(s)});
})()`);
console.log('compose: done', typeof result, String(result).length);
const out = JSON.parse(result);
const ext = out.mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
const file = OUT + 's1-11a_playback.' + ext;
fs.writeFileSync(file, Buffer.from(out.b64, 'base64'));
console.log('saved', file, out.mime, out.w + 'x' + out.h, out.seconds + 's', Math.round(fs.statSync(file).size / 1024) + 'KB');
b.close();
process.exit(0);
