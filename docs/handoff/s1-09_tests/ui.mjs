// S1-09 화면(악기 · 이펙트 칸) 실제 서버 시험 — 헤드리스 Chrome
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과
//       프로젝트 "S1-09 UI Test" (트랙 6개) 가 DB 에 있습니다.
//       Bass Synth 트랙에는 synth_sub 악기와 이펙트 2개(compressor · eq3)가 있어야 합니다.
// 이 시험은 4번에서 이펙트를 하나 붙이고 7번에서 그 카드를 떼므로, 다시 돌려도 상태가 같습니다.
// 실행: node docs/handoff/s1-09_tests/ui.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-18_s1-09_devices/';
const BASE = 'http://localhost:8001';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9530, 1600, 1000);
const q = (e) => b.ev(e);
const sleep = (ms) => b.sleep(ms);

const click = async (sel, wait = 350) => {
  const pos = await q(`(()=>{const e=document.querySelector(${J(sel)}); if(!e) return ''; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`);
  if (!pos) return false;
  const r = JSON.parse(pos);
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await b.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  }
  await sleep(wait);
  return true;
};

const dragBy = async (sel, dy, wait = 700) => {
  const pos = await q(`(()=>{const e=document.querySelector(${J(sel)}); if(!e) return ''; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`);
  if (!pos) return false;
  const r = JSON.parse(pos);
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(60);
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y - dy, button: 'left', buttons: 1 });
  await sleep(120);
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y - dy, button: 'left', clickCount: 1 });
  await sleep(wait);
  return true;
};

const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
// 화면 이동 — 저장하지 않은 변경이 있으면 "떠나시겠습니까?" 창(beforeunload)이 떠서 Page.navigate 가 끝나지 않으므로, 창이 뜨면 수락합니다 (S1-11 시험과 같은 방식)
const nav = async (url) => {
  const before = b.events.length;
  const p = b.send('Page.navigate', { url });
  let done = false; p.then(() => { done = true; });
  for (let i = 0; i < 80 && !done; i++) {
    await sleep(150);
    if (b.events.slice(before).some((e) => e.method === 'Page.javascriptDialogOpening')) await b.send('Page.handleJavaScriptDialog', { accept: true });
  }
  await sleep(2500);
};
const errs = () => b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;

/* ── 1. 로그인 ─────────────────────────────────────────────── */
await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

const found = await api(`const j=await m.api.get('/projects'); const p=(j.items||[]).filter(x=>x.title==='S1-09 UI Test')[0]; if(!p) return '0|0'; const t=await m.api.get('/projects/'+p.project_id+'/tracks'); return p.project_id+'|'+t.total`);
const [pid, trackTotal] = String(found).split('|');
check('시험 프로젝트와 트랙이 있음', Number(pid) > 0 && Number(trackTotal) >= 4, 'pid=' + pid + ' tracks=' + trackTotal);

/* ── 2. 실제 모드로 열기 ───────────────────────────────────── */
await nav(`${BASE}/studioNx.html?projectId=${pid}`);
const errs0 = errs();

const shape = JSON.parse(await q(`(()=>{
  const rows=[...document.querySelectorAll('#tracks > .sq-track')];
  const master=document.querySelector('.sq-track--master');
  const rets=[...document.querySelectorAll('.sq-track--return')];
  const inst=document.querySelector('#tracks > .sq-track .sq-track__name small');
  return JSON.stringify({
    rows: rows.length,
    names: rows.map(r=>r.querySelector('.sq-track__name b').textContent.replace(/\\s+/g,' ').trim()),
    live: document.querySelectorAll('.sq-acc.is-live').length,
    masterId: master?master.dataset.trackId:null,
    masterHidden: master?!!master.hidden:null,
    masterName: master?master.querySelector('.sq-track__name b').textContent.replace(/\\s+/g,' ').trim():null,
    returnRows: rets.length,
    returnVisible: rets.filter(r=>!r.hidden).length,
    returnInTracks: rets.filter(r=>document.getElementById('tracks').contains(r)).length,
    tplHidden: (document.getElementById('acc-2')||{}).hidden,
    demoAcc1: !!document.getElementById('acc-1'),
    strips: document.querySelectorAll('#mixer-strips .sq-strip').length,
    stripsMaster: document.querySelectorAll('#panel-mixer .sq-strip--master').length,
    mixerText: (document.querySelector('#panel-mixer .sq-bottom__head span')||{}).textContent,
    color: rows.map(r=>r.dataset.color),
    firstId: rows.length?rows[0].dataset.trackId:null,
    firstSub: inst?inst.textContent:null
  });
})()`));
const trackId = await q(`(()=>{const r=document.querySelectorAll('#tracks > .sq-track[data-track-id]');return r.length?r[0].dataset.trackId:null})()`) || String(shape.masterId || '0');

check('실제 트랙 줄 5개 + MASTER 는 예시 줄 재사용', shape.rows === 5 && Number(shape.masterId) > 0, J(shape.names));
check('MASTER 줄이 보이고 이름이 MASTER', shape.masterHidden === false && String(shape.masterName).indexOf('MASTER') >= 0, J(shape.masterName));
check('RETURN 실제 줄은 #tracks 안에서 보임', shape.returnInTracks === 1 && shape.returnVisible === 1, J({ r: shape.returnRows, v: shape.returnVisible, i: shape.returnInTracks }));
check('데모 리턴 줄 2개는 감춤', shape.returnRows - shape.returnInTracks === 2, J(shape.returnRows));
check('예시 #acc-1 은 사라지고 #acc-2 본보기만 남음', shape.demoAcc1 === false && shape.tplHidden === true, J({ a1: shape.demoAcc1, hidden: shape.tplHidden }));
check('트랙 줄 아래 작은 글에 악기 이름(Sub)', String(shape.firstSub).indexOf('Sub') >= 0, J(shape.firstSub));
check('색 규칙: AUDIO 1개 + 나머지 1~5', shape.color.filter((c) => c === 'audio').length === 1 && shape.color.filter((c) => Number(c) >= 1 && Number(c) <= 5).length === 4, J(shape.color));
check('아래 믹서 줄 5개 + MASTER 1개', shape.strips === 5 && shape.stripsMaster === 1, J({ strips: shape.strips, master: shape.stripsMaster, text: shape.mixerText }));
check('펼치기 전에는 라이브 칸이 없음', shape.live === 0, String(shape.live));
check('여기까지 자바스크립트 오류 없음', errs() === errs0, String(errs() - errs0));
await b.shot(OUT + '01_tracks.png');

/* ── 3. V 펼침 → 서버 값으로 채워짐 ────────────────────────── */
await click('#tracks > .sq-track .sq-expand');
await sleep(900);
const cell = JSON.parse(await q(`(()=>{
  const acc=document.querySelector('#tracks > .sq-acc.is-live');
  if(!acc) return JSON.stringify({none:true});
  const c=(l)=>acc.querySelector('[aria-label="'+l+'"]');
  const inst=c('Instruments')||c('Instrument');
  return JSON.stringify({
    none:false,
    instTitle:((cell=>cell?cell.textContent.replace(/\\s+/g,' ').trim().slice(0,42):'')(c('Instruments')||c('Instrument'))),
    instCards:acc.querySelectorAll('.sq-fx[data-device-kind="INSTRUMENT"]').length,
    fxCards:acc.querySelectorAll('.sq-fx[data-device-kind="EFFECT"]').length,
    knobs:acc.querySelectorAll('.sq-knob[data-param-key]').length,
    flows:acc.querySelectorAll('.sq-flow').length,
    preset:(acc.querySelector('.sq-fx__preset')||{}).textContent,
    connTitle:((c('Connect to another')||{}).textContent||'').replace(/\\s+/g,' ').trim(),
    connOptions:[...document.querySelectorAll('.sq-acc.is-live [aria-label="Connect to another"] .sq-route__type option')].map(o=>o.value).join(','),
    connTrackInput:!!document.querySelector('.sq-acc.is-live [aria-label="Connect to another"] input.sq-route__track'),
    fader:!!acc.querySelector('.sq-mixer .sq-fader'),
    layerRow:!!acc.querySelector('.sq-fx__mix .sq-irow__db'),
    fxTitle:(acc.querySelector('[aria-label="Effects"] h3')||{}).textContent
  });
})()`));
check('펼치면 라이브 칸(.sq-acc.is-live)이 생김', !cell.none, J(cell));
check('악기 칸 제목 INSTRUMENTS + MIDI 배지', String(cell.instTitle).indexOf('INSTRUMENTS') === 0 && String(cell.instTitle).indexOf('MIDI') > 0, J(cell.instTitle));
check('이펙트 칸 제목 EFFECTS + 안내', String(cell.fxTitle).indexOf('EFFECTS') === 0, J(cell.fxTitle));
check('악기 카드 1 · 이펙트 카드 2 · 화살표 1', cell.instCards === 1 && cell.fxCards === 2, J({ i: cell.instCards, f: cell.fxCards }));
check('카드에 노브 2개 이상, 프리셋 이름 표시', cell.knobs >= 2 && String(cell.preset).indexOf('Preset') === 0, J({ k: cell.knobs, p: cell.preset }));
check('악기 카드 아래 겹 볼륨 줄', cell.layerRow === true, J(cell.layerRow));
// (예전에는 "S1-10 에서 구현" 안내 문구를 기대했지만, S1-10a 에서 Connect 가 구현되어 선택 칸이 생겼습니다)
check('CONNECT 칸에 Connect 선택(None, Connected)과 Track 입력이 있음', cell.connOptions === 'none,connected' && cell.connTrackInput === true, J({ o: cell.connOptions, t: cell.connTrackInput }));
check('믹서 칸에 페이더', cell.fader === true, J(cell.fader));
await b.shot(OUT + '02_accordion.png');

/* ── 4. 이펙트 ＋ → 고르기 창 → 붙이기(저장) ───────────────── */
const fxBefore = Number(await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); return r.length`));
await click('.sq-acc.is-live [aria-label="Effects"] .sq-fx-add');
await sleep(500);
const pick = JSON.parse(await q(`(()=>{
  const d=document.getElementById('plugin-picker');
  const items=[...document.querySelectorAll('#picker-list .sq-plug')];
  return JSON.stringify({open:!!(d&&d.open), title:(document.getElementById('plugin-picker-title')||{}).textContent, note:(document.getElementById('picker-note')||{}).textContent, count:items.length, names:items.map(x=>x.querySelector('.sq-plug__name').textContent), kinds:items.map(x=>x.querySelector('.sq-plug__badge').textContent)});
})()`));
check('＋ 로 고르기 창이 열리고 이펙트만 보임', pick.open === true && pick.count >= 4 && pick.kinds.every((k) => k === 'EFFECT'), J({ c: pick.count, k: pick.kinds }));
check('제목·안내 글(Plugins 표 개수)', pick.title === 'Choose an effect' && /plugins in the Plugins table/.test(pick.note), J({ t: pick.title, n: pick.note }));
await b.shot(OUT + '03_picker.png');

await click('#picker-list .sq-plug');
await sleep(900);
const fxAfter = Number(await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); return r.length`));
const afterAdd = Number(await q(`document.querySelectorAll('.sq-acc.is-live [aria-label="Effects"] .sq-fx[data-device-kind="EFFECT"]').length`));
const addedId = await q(`(()=>{const c=[...document.querySelectorAll('.sq-acc.is-live [aria-label="Effects"] .sq-fx[data-device-kind="EFFECT"]')]; return c.length?c[c.length-1].getAttribute('data-track-plugin-id'):''})()`);
check('고른 이펙트가 서버에 저장됨(POST)', fxAfter === fxBefore + 1, J({ before: fxBefore, after: fxAfter }));
check('붙인 이펙트가 카드로 바로 보임', afterAdd === fxAfter, J({ dom: afterAdd, api: fxAfter }));
await b.shot(OUT + '04_after_add.png');

/* ── 5. 노브 끌기 → 파라미터 저장(PATCH) ───────────────────── */
const knobBefore = await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); const x=r.slice().sort(function(a,b){return b.slot_index-a.slot_index})[0]; return JSON.stringify({id:x.track_plugin_id, params:x.params})`);
const kb = JSON.parse(knobBefore);
await dragBy(`.sq-acc.is-live .sq-fx[data-track-plugin-id="${kb.id}"] .sq-knob`, 45);
const knobAfter = await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); const x=r.filter(y=>y.track_plugin_id===${kb.id})[0]; return JSON.stringify({params:x.params})`);
const ka = JSON.parse(knobAfter);
check('노브를 끌면 파라미터가 서버에 저장됨(PATCH)', J(ka.params) !== J(kb.params), J({ before: kb.params, after: ka.params }));

/* ── 6. 카드 몸통 → 상세 모달 (첫 이펙트 카드로) ──────────── */
const modalId = Number(await q(`(()=>{const c=document.querySelector('.sq-acc.is-live [aria-label="Effects"] .sq-fx[data-device-kind="EFFECT"]'); return c?c.getAttribute('data-track-plugin-id'):0})()`));
await click(`.sq-acc.is-live .sq-fx[data-track-plugin-id="${modalId}"] .sq-fx__preset`);
await sleep(600);
const modal = JSON.parse(await q(`(()=>{
  const d=document.getElementById('device-modal');
  const sel=document.getElementById('device-preset');
  return JSON.stringify({
    open:!!(d&&d.open),
    title:(document.getElementById('device-title')||{}).textContent,
    sub:(document.getElementById('device-sub')||{}).textContent,
    panels:document.querySelectorAll('#device-params .sq-param').length,
    tabs:[...document.querySelectorAll('#device-tabs button')].map(b=>b.textContent.trim()),
    presets:sel?sel.options.length:0,
    abA:document.querySelector('#device-ab [data-ab="A"]').getAttribute('aria-pressed'),
    abB:document.querySelector('#device-ab [data-ab="B"]').getAttribute('aria-pressed'),
    save:(document.getElementById('device-save')||{}).className,
    state:(document.getElementById('device-state')||{}).textContent
  });
})()`));
check('카드를 누르면 상세 모달이 열림', modal.open === true, J(modal));
const tabCounts = [Number(modal.panels)];
if (modal.open && modal.tabs.length > 1) {
  await click('#device-tabs button:last-child', 350);
  tabCounts.push(Number(await q(`document.querySelectorAll('#device-params .sq-param').length`)));
}
check('모달에 플러그인 이름 · 그룹 탭 · 파라미터 줄이 있음',
  String(modal.title).length > 0 && modal.tabs.length >= 1 && tabCounts.every((n) => n >= 1),
  J({ t: modal.title, tabs: modal.tabs, rows: tabCounts }));
check('A·B 는 A 가 눌린 상태로 시작', modal.abA === 'true' && modal.abB === 'false', J({ a: modal.abA, b: modal.abB }));
check('모달을 열면 저장됨 표시가 없음(is-dirty 아님)', String(modal.save).indexOf('is-dirty') < 0, J(modal.save));
await b.shot(OUT + '05_modal.png');

/* 모달 안 값 고치기 → 저장 버튼이 켜지고, Save 로 저장 */
const modalBase = await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); const x=r.filter(y=>y.track_plugin_id===${modalId})[0]; return JSON.stringify(x.params)`);
let knobCount = 0;
for (let i=0;i<3;i++){
  knobCount = Number(await q(`document.querySelectorAll('#device-params [data-modal-param]').length`));
  if (knobCount>0) break;
  await sleep(200);
}
const target = await q(`document.querySelectorAll('#device-params .sq-knob').length>0?'#device-params .sq-knob':'#device-params [data-modal-param]'`);
// 노브가 이미 최댓값(예: 컴프레서 Threshold 0 dB)이면 위로 끌어도 값이 바뀌지 않으므로, 중간보다 높으면 아래로, 아니면 위로 끕니다
const knobPos = JSON.parse(await q(`(()=>{const e=document.querySelector(${J(target)}); if(!e) return '{}'; const g=(k)=>Number(e.getAttribute(k)); return JSON.stringify({min:g('aria-valuemin'),max:g('aria-valuemax'),now:g('aria-valuenow')});})()`));
await dragBy(target, knobPos.now > (knobPos.min + knobPos.max) / 2 ? -45 : 45, 500);
const dirty = await q(`(document.getElementById('device-save')||{}).className`);
check('모달 노브를 끌면 저장 안 된 표시(is-dirty)', knobCount > 0 && String(dirty).indexOf('is-dirty') >= 0, J({ knobs: knobCount, cls: dirty }));
await click('#device-save', 900);
const savedState = JSON.parse(await q(`(()=>{ return JSON.stringify({ open:document.getElementById('device-modal').open, cls:(document.getElementById('device-save')||{}).className, draft:1 }); })()`));
const modalParams = await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); const x=r.filter(y=>y.track_plugin_id===${modalId})[0]; return JSON.stringify(x.params)`);
check('Save 로 저장되면 저장 안 된 표시가 사라짐', String(savedState.cls).indexOf('is-dirty') < 0, J(savedState));
check('모달에서 바꾼 값이 서버에 저장됨', J(modalParams) !== J(modalBase), J({ before: modalBase, after: modalParams }));
const afterModal = Number(await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); return r.length`));
check('모달 조작 뒤에도 이펙트 개수 그대로', afterModal === fxAfter, J({ a: afterModal, e: fxAfter }));
await click('#device-modal [data-modal="close"]', 400);

/* ── 7. 카드 ✕ → 떼기(저장) ───────────────────────────────── */
// 떼기 전에 묻는 확인 창은 헤드리스에서 자동으로 거부되므로, 사용자가 확인한 경우로 둡니다
await q('window.confirm = function () { return true; }; 1');
// 4번에서 붙인 카드를 떼므로, 시험을 다시 돌려도 서버 상태가 처음으로 돌아갑니다
const delId = addedId;
const fxBefDel = Number(await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); return r.length`));
if (delId) await click(`.sq-acc.is-live .sq-fx[data-track-plugin-id="${delId}"] .sq-fx__del`);
await sleep(900);
const fxDel = Number(await api(`const r=await m.api.get('/tracks/${trackId}/plugins'); return r.length`));
check('카드 ✕ 로 이펙트가 서버에서 떨어짐(DELETE)', !!delId && fxDel === fxBefDel - 1, J({ id: delId, bef: fxBefDel, del: fxDel }));
await b.shot(OUT + '05_after_delete.png');

/* ── 8. 트랙 볼륨 끌기 → 저장 ─────────────────────────────── */
// 볼륨은 -60 ~ +6 dB 라, 이미 최대(+6)면 위로 끌어도 값이 바뀌지 않습니다.
// 그래서 지금 값에서 바뀔 수 있는 쪽으로 끕니다.
const volBefore = await api(`const r=await m.api.get('/tracks/${trackId}'); return JSON.stringify({v: Number(r.volume_db || 0)})`);
const bv0 = JSON.parse(volBefore).v;
await dragBy('.sq-acc.is-live .sq-mixer .sq-fader', bv0 > -30 ? -50 : 50);
await sleep(600);
const volAfter = await api(`const r=await m.api.get('/tracks/${trackId}'); return JSON.stringify({v: Number(r.volume_db || 0)})`);
const bv=JSON.parse(volBefore).v, av=JSON.parse(volAfter).v;
check('믹서 페이더를 끌면 트랙 볼륨이 저장됨(PATCH)', bv!==av, J({ before: volBefore, after: volAfter }));

/* ── 9. M · S · ⏻ 저장 ───────────────────────────────────── */
await click('#tracks > .sq-track .sq-track__head .is-mute');
await sleep(700);
const muted = await api(`const r=await m.api.get('/tracks/${trackId}'); return String(r.is_muted)`);
check('트랙 줄 M 을 누르면 저장됨', muted === 'true', muted);
await click('#tracks > .sq-track .sq-track__head .is-mute');
await sleep(700);
await click('#tracks > .sq-track .sq-track__head .sq-power');
await sleep(700);
const off = await api(`const r=await m.api.get('/tracks/${trackId}'); return String(r.is_enabled)`);
check('트랙 ⏻ 을 누르면 꺼짐이 저장됨', off === 'false', off);
await click('#tracks > .sq-track .sq-track__head .sq-power');
await sleep(500);

check('여기까지 자바스크립트 오류 없음', errs() === errs0, String(errs() - errs0));

/* ── 10. projectId 없이 열면 예시 화면 그대로 ─────────────── */
await nav(`${BASE}/studioNx.html`);
const demo = JSON.parse(await q(`(()=>{
  return JSON.stringify({
    rows: document.querySelectorAll('#tracks > .sq-track').length,
    live: document.querySelectorAll('.sq-acc.is-live').length,
    acc1: !!document.getElementById('acc-1'),
    masterId: (document.querySelector('.sq-track--master')||{}).dataset ? document.querySelector('.sq-track--master').dataset.trackId : null
  });
})()`));
check('projectId 가 없으면 예시 트랙(2개)과 예시 #acc-1 이 그대로', demo.rows >= 2 && demo.acc1 === true && demo.live === 0, J(demo));
await b.shot(OUT + '06_demo_mode.png');
check('예시 화면에서도 자바스크립트 오류 없음', errs() === errs0, String(errs() - errs0));

const ok = summary();
await b.close();
process.exit(ok ? 0 : 1);
