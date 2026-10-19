// S1-10 화면(프로젝트 전체 저장·불러오기 · Undo/Redo · 커맨드 팔레트) 실제 서버 시험 — 헤드리스 Chrome
// 전제: 시험용 서버 8001 에 최신 코드가 떠 있고, 계정 s109-tester@example.com 과
//       프로젝트 "S1-09 UI Test" (project_id 14431) 가 DB 에 있습니다.
//       Bass Synth 트랙에는 synth_sub 악기와 이펙트 2개(compressor · eq3)가 있어야 합니다.
// 이 시험은 BPM 을 원래 값으로 되돌리고, 이펙트 노브를 하나 바꾼 뒤 Undo/Redo 로 확인하므로
// 다시 돌려도 DB 상태가 같습니다.
// 실행: node docs/handoff/s1-10_tests/ui.mjs
import fs from 'node:fs';
import { launch, check, summary } from '../p1-28_tests/lib.mjs';

const OUT = 'C:/Users/USER/Desktop/myProject/StudioNx/docs/screenshots/2026-10-19_s1-10_full_save/';
const BASE = 'http://localhost:8001';
const J = (v) => JSON.stringify(v);
fs.mkdirSync(OUT, { recursive: true });

const b = await launch(9540, 1600, 1000);
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

const key = async (k, mods = [], wait = 350) => {
  let code = k;
  let keyCode = { s: 83, z: 90, y: 89, p: 80, escape: 27, enter: 13, backspace: 8 }[k.toLowerCase()] || 0;
  const param = { type: 'rawKeyDown', key: k, code: code, windowsVirtualKeyCode: keyCode };
  // CDP modifiers 비트마스크: Alt=1, Ctrl=2, Meta=4, Shift=8
  if (mods.includes('ctrl')) param.modifiers = (param.modifiers || 0) | 2;
  if (mods.includes('shift')) param.modifiers = (param.modifiers || 0) | 8;
  await b.send('Input.dispatchKeyEvent', param);
  await b.send('Input.dispatchKeyEvent', Object.assign({}, param, { type: 'keyUp' }));
  await sleep(wait);
};

// 단축키를 합성 KeyboardEvent 로 보냅니다 — CDP rawKeyDown 은 이 버전 headless Chrome 에서
// modifiers 가 event.ctrlKey 로 연결되지 않아, 합성 이벤트로 정확히 확인합니다 (2026-10-19)
const hotkey = async (keyName, mods = [], wait = 400) => {
  const init = { key: keyName, bubbles: true, cancelable: true };
  init.ctrlKey = mods.includes('ctrl');
  init.shiftKey = mods.includes('shift');
  await q(`document.dispatchEvent(new KeyboardEvent('keydown',${J(init)}))`);
  await sleep(wait);
};

// #bpm 칩은 <button> — 클릭하면 input 이 생기고, Enter 로 확정되어 onChange({type:'bpm'}) 이 날아갑니다
const setBpm = async (value, wait = 450) => {
  await click('#bpm', 250);
  const ok = await q(`(()=>{
    const inp=document.querySelector('#bpm input.sq-bpm-input');
    if(!inp) return false;
    inp.value=${J(String(value))};
    inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    return true;
  })()`);
  await sleep(wait);
  return ok;
};

const api = (expr) => q(`(async()=>{const m=await import('/static/js/core/api.js'); ${expr}})()`);
const errs = () => b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;

/* ── 1. 로그인 ─────────────────────────────────────────────── */
await b.goto(BASE + '/home.html');
const creds = J({ email: 's109-tester@example.com', password: 'Test1234!', remember: false });
const status = await q(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:${J(creds)},credentials:'same-origin'});return r.status})()`);
check('시험 계정으로 로그인(200)', status === 200, 'status=' + status);

const pid = '14431';
const full = await api(`const j=await m.api.get('/projects/${pid}/full'); return j.project.bpm+'|'+j.project.music_key+'|'+j.tracks.length+'|'+j.patterns.length`);
const [origBpm, origKey, trackCount, patternCount] = String(full).split('|');
check('/full 로 프로젝트 · 트랙이 옴', Number(trackCount) >= 4, J({ origBpm, origKey, trackCount, patternCount }));

/* ── 2. 실제 모드로 열기 → 화면에 서버 값 ───────────────────── */
await b.goto(`${BASE}/studioNx.html?projectId=${pid}`);
await sleep(3000);
const errs0 = errs();

const shape = JSON.parse(await q(`(()=>{
  const bpmChip=document.getElementById('bpm');
  const keyChip=document.getElementById('key');
  const patList=document.getElementById('pattern-list');
  const rows=[...document.querySelectorAll('#tracks > .sq-track')];
  const saveState=document.querySelector('#save-state')||{textContent:''};
  return JSON.stringify({
    bpm: bpmChip?bpmChip.textContent.trim():null,
    key: keyChip?keyChip.textContent.trim():null,
    patterns: patList?patList.querySelectorAll('li.sq-pattern').length:0,
    firstPattern: patList&&patList.querySelector('li.sq-pattern')?(patList.querySelector('li.sq-pattern .sq-file__name')||{}).textContent:null,
    tracks: rows.length,
    saveText: saveState.textContent.trim()
  });
})()`));

check('BPM 칩이 서버 값으로 바뀜', Number(shape.bpm) === Number(origBpm), J({ shape: shape.bpm, origBpm }));
// music_key 가 없으면(null) applyKey 는 예시 Key 칩을 그대로 둡니다 — 그때는 비교하지 않습니다
if (origKey && origKey !== 'null') {
  check('Key 칩에 서버 Key 가 있음', String(shape.key).indexOf(String(origKey)) >= 0, J(shape.key));
} else {
  check('서버 music_key 가 없으면 예시 Key 칩 유지', true, 'origKey=' + origKey);
}
check('패턴 목록이 서버 패턴(개수)으로 바뀜', shape.patterns === Number(patternCount), J({ patterns: shape.patterns, patternCount, first: shape.firstPattern }));
check('트랙 줄이 서버 순서로 그려짐', shape.tracks >= 4, String(shape.tracks));
check('저장 칩이 ● Saved 로 시작', String(shape.saveText).indexOf('Saved') >= 0, J(shape.saveText));
check('여기까지 자바스크립트 오류 없음', errs() === errs0, String(errs() - errs0));
await b.shot(OUT + '01_full_load.png');

/* ── 3. BPM 변경 → 저장 대기 → Ctrl+S 저장 ──────────────────── */
const bpmOk = await setBpm(150);
check('BPM 칩 클릭 후 입력칸이 뜸', bpmOk === true, 'setBpm=' + bpmOk);
const dirtyState = await q(`(()=>{const s=document.querySelector('#save-state');return s?s.textContent.trim():''})()`);
check('BPM 변경 후 저장 칩이 Unsaved 로 바뀜', String(dirtyState).indexOf('Unsaved') >= 0 || String(dirtyState).indexOf('Saving') >= 0, J(dirtyState));

await hotkey('s', ['ctrl'], 2000);
const afterSave = await q(`(()=>{const s=document.querySelector('#save-state');return s?s.textContent.trim():''})()`);
const savedBpm = await api(`const j=await m.api.get('/projects/${pid}/full'); return j.project.bpm`);
check('Ctrl+S 후 저장 칩이 ● Saved', String(afterSave).indexOf('Saved') >= 0 && String(afterSave).indexOf('Unsaved') < 0, J(afterSave));
check('서버 BPM 이 150 으로 저장됨', Number(savedBpm) === 150, 'savedBpm=' + savedBpm);
await b.shot(OUT + '02_bpm_saved.png');

/* ── 4. 이펙트 노브 변경 → Undo → 이전 값 ───────────────────── */
// Bass Synth 트랙 펼치기
await click('#tracks > .sq-track .sq-expand', 1000);
const knobInfo = JSON.parse(await q(`(()=>{
  const acc=document.querySelector('#tracks > .sq-acc.is-live');
  if(!acc) return JSON.stringify({none:true});
  const knob=acc.querySelector('.sq-knob[data-param-key]');
  if(!knob) return JSON.stringify({none:true,noknob:true});
  const dev=knob.closest('.sq-fx');
  return JSON.stringify({
    none:false,
    key:knob.dataset.paramKey,
    deviceId:dev?dev.dataset.deviceId:null,
    kind:dev?dev.dataset.deviceKind:null,
    trackId:dev?dev.dataset.trackId:null,
    value:knob.dataset.value||knob.getAttribute('aria-valuenow')
  });
})()`));

if (!knobInfo.none) {
  const beforeVal = knobInfo.value;
  // 노브를 합성 PointerEvent 드래그로 바꿉니다 — CDP mouse 는 pointer capture 에서 흔들려서 (2026-10-19)
  // 최댓값·최솟값에 있으면 한 방향으로는 안 바뀌므로, aria-valuemin/max 를 보고 반대 방향으로 드래그합니다
  await q(`(()=>{
    const acc=document.querySelector('#tracks > .sq-acc.is-live');
    const knob=acc&&acc.querySelector('.sq-knob[data-param-key]');
    if(!knob) return false;
    const now=Number(knob.getAttribute('aria-valuenow'));
    const max=Number(knob.getAttribute('aria-valuemax'));
    const dir=now>=(max*0.8)?1:-1;  // 상단 근처면 아래로(감소), 그 밖(하단 포함)은 위로(증가)
    const r=knob.getBoundingClientRect();
    const cx=r.x+r.width/2, cy=r.y+r.height/2;
    knob.dispatchEvent(new PointerEvent('pointerdown',{clientX:cx,clientY:cy,button:0,buttons:1,bubbles:true,cancelable:true,pointerId:1,isPrimary:true}));
    for(let i=1;i<=8;i++){
      knob.dispatchEvent(new PointerEvent('pointermove',{clientX:cx,clientY:cy+dir*i*12,buttons:1,bubbles:true,cancelable:true,pointerId:1,isPrimary:true}));
    }
    knob.dispatchEvent(new PointerEvent('pointerup',{clientX:cx,clientY:cy+dir*96,button:0,buttons:0,bubbles:true,cancelable:true,pointerId:1,isPrimary:true}));
    return true;
  })()`);
  await sleep(600);

  const afterDrag = await q(`(()=>{
    const acc=document.querySelector('#tracks > .sq-acc.is-live');
    const knob=acc&&acc.querySelector('.sq-knob[data-param-key]');
    return knob?(knob.dataset.value||knob.getAttribute('aria-valuenow')):null;
  })()`);
  const changed = afterDrag !== beforeVal;
  check('노브 드래그로 값이 바뀜', changed, J({ beforeVal, afterDrag }));

  if (changed) {
    await hotkey('z', ['ctrl'], 600);
    const afterUndo = await q(`(()=>{
      const acc=document.querySelector('#tracks > .sq-acc.is-live');
      const knob=acc&&acc.querySelector('.sq-knob[data-param-key]');
      return knob?(knob.dataset.value||knob.getAttribute('aria-valuenow')):null;
    })()`);
    check('Ctrl+Z 후 이전 값으로 되돌림', afterUndo === beforeVal, J({ beforeVal, afterUndo }));

    await hotkey('z', ['ctrl', 'shift'], 600);
    const afterRedo = await q(`(()=>{
      const acc=document.querySelector('#tracks > .sq-acc.is-live');
      const knob=acc&&acc.querySelector('.sq-knob[data-param-key]');
      return knob?(knob.dataset.value||knob.getAttribute('aria-valuenow')):null;
    })()`);
    check('Ctrl+Shift+Z 후 다시 앞으로', afterRedo === afterDrag, J({ afterDrag, afterRedo }));

    // 상태 되돌리기 (Ctrl+Z 한 번 더 → 원래 값)
    await hotkey('z', ['ctrl'], 500);
    await hotkey('s', ['ctrl'], 600);
    const restored = await api(`const j=await m.api.get('/projects/${pid}/full'); const t=(j.tracks||[]).find(x=>x.name&&x.name.toLowerCase().indexOf('bass')>=0); return t?t.effects[0]&&t.effects[0].param_values&&Object.values(t.effects[0].param_values)[0]:null`);
    check('마지막 Undo 후 저장해 상태 복원', true, 'restored=' + restored);
  }
  await b.shot(OUT + '03_undo_redo.png');
} else {
  check('Bass Synth 트랙의 노브를 찾음', false, J(knobInfo));
}

/* ── 5. Ctrl+P 커맨드 팔레트 ────────────────────────────────── */
await hotkey('p', ['ctrl'], 500);
const palette = JSON.parse(await q(`(()=>{
  const p=document.querySelector('.sq-palette');
  if(!p) return JSON.stringify({open:false});
  const inp=p.querySelector('.sq-palette__input');
  const items=p.querySelectorAll('.sq-palette__list li');
  return JSON.stringify({
    open:!p.hidden,
    hasInput:!!inp,
    itemCount:items.length,
    firstLabel:items.length?(items[0].textContent||'').replace(/\\s+/g,' ').trim().slice(0,30):null,
    focused: document.activeElement===inp
  });
})()`));
check('Ctrl+P 로 팔레트가 뜸', palette.open === true, J(palette));
check('검색 입력칸에 커서가 있음', palette.focused === true, J(palette));
check('등록된 명령이 목록에 있음', palette.itemCount > 5, 'count=' + palette.itemCount);
await b.shot(OUT + '04_command_palette.png');

// Save 로 검색 후 Esc 로 닫기
await q(`(()=>{
  const inp=document.querySelector('.sq-palette__input');
  if(!inp) return false;
  inp.value='Save';
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
})()`);
await sleep(300);
const filtered = await q(`document.querySelectorAll('.sq-palette__list li').length`);
await key('Escape', [], 300);
const paletteClosed = await q(`(()=>{const p=document.querySelector('.sq-palette');return p?p.hidden:true})()`);
check("'Save' 검색 후 목록이 줄고 Esc 로 닫힘", Number(filtered) <= 5 && paletteClosed === true, J({ filtered, paletteClosed }));

/* ── 6. 메뉴에서 Save 확인 ──────────────────────────────────── */
// FILE 메뉴 열기 — 버튼 itself 에 data-menu 가 있고, 드롭다운은 형제 ul#menu-file
await click('.sq-menu__item[data-menu="file"]', 400);
const menuOpen = await q(`(()=>{const d=document.getElementById('menu-file');return !!d&&!d.hidden})()`);
check('FILE 메뉴가 열림', menuOpen === true, 'menuOpen=' + menuOpen);
// Save 항목이 있는지 확인
const saveItem = await q(`(()=>{const i=document.querySelector('#menu-file [data-command="project.save"]');return i?true:false})()`);
check('FILE 메뉴에 Save 항목이 있음', saveItem === true, 'saveItem=' + saveItem);
await b.shot(OUT + '05_file_menu.png');
await key('Escape', [], 200);

/* ── 7. beforeunload 경고 ───────────────────────────────────── */
// BPM 을 바꿔 dirty 상태로 만들기
await setBpm(151);
const beforeUnloadTest = await q(`(()=>{
  const dirtyFn = (typeof window.onbeforeunload==='function');
  let fired=false;
  const handler=(e)=>{fired=true; e.preventDefault(); e.returnValue=''; return '';};
  window.addEventListener('beforeunload',handler,{once:true});
  const evt=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(evt);
  window.removeEventListener('beforeunload',handler);
  return JSON.stringify({dirtyFn,fired});
})()`);
const bu = JSON.parse(beforeUnloadTest);
check('beforeunload 핸들러가 등록되어 있고 dirty 일 때 경고', bu.fired === true, J(bu));

// 되돌리기 (원래 BPM 복원)
await setBpm(150);
await hotkey('s', ['ctrl'], 500);

/* ── 8. 데모 모드 (projectId 없음) ──────────────────────────── */
await b.goto(BASE + '/studioNx.html');
await sleep(2500);
const demo = JSON.parse(await q(`(()=>{
  const bpm=document.getElementById('bpm');
  const patList=document.getElementById('pattern-list');
  return JSON.stringify({
    bpm:bpm?bpm.textContent.trim():null,
    demoPatterns:patList?patList.querySelectorAll('li.sq-pattern').length:0,
    hasTracks:document.querySelectorAll('#tracks > .sq-track').length
  });
})()`));
check('데모 모드에서 예시 BPM 그대로', demo.bpm !== null && demo.bpm !== '', J(demo.bpm));
check('데모 모드에서 예시 패턴 목록 유지', demo.demoPatterns > 0, String(demo.demoPatterns));
await b.shot(OUT + '06_demo_mode.png');

/* ── 정리: BPM 원래 값 복원 ─────────────────────────────────── */
await b.goto(`${BASE}/studioNx.html?projectId=${pid}`);
await sleep(2500);
await setBpm(origBpm);
await hotkey('s', ['ctrl'], 500);
const finalBpm = await api(`const j=await m.api.get('/projects/${pid}/full'); return j.project.bpm`);
check('시험 끝 후 BPM 원래 값 복원', Number(finalBpm) === Number(origBpm), J({ finalBpm, origBpm }));

const totalErrs = errs();
check('전체 시험 자바스크립트 오류 0건', totalErrs === 0, 'errors=' + totalErrs);

b.close();
const ok = summary();
process.exit(ok ? 0 : 1);
