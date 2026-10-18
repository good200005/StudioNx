// 시퀀서 화면 버튼 (구현: AI — 사용자 요청 2026-10-06 "나머지 버튼들도 구현")
// 설명: docs/ai-notes/31_sequencer_buttons.md
// 상단(메뉴 · 언어 · PAT/SONG · BPM · 시간 · 💬 · Nyxi · Pattern/Key · 창 바로가기) · 왼쪽(카테고리 · 필터 · 검색 · 업로드 · 협업)
// · 아래 칸(열기/닫기 · 믹서 탭 · 샘플 설정 · Nyxi Agent) · 트랙 펼침(이펙트 · 악기 레이어 · Connect to Another) · 스페이스 · Tab
// 소리 엔진 · 서버가 필요한 것은 화면 상태만 바꾸고 showToast 로 알림

import {
  showToast, startPlayback, pausePlayback, isPlaying, getPlayheadBar, setPlayheadBar, setDrawTemplate, addTrack,
  addGroup, groupSelectedTracks, ungroupTracks, deleteSelectedTracks, selectedTracks, selectTrack, clearTrackSelection,
} from './sequencer-arrange.js';
import { openRoll } from './sequencer-roll.js';
import {
  fetchSampleList, uploadSample, fetchSampleFileUrl, fetchSampleWaveform,
  renameSample, setSampleTags, deleteSample, fetchTags,
} from '../core/api.js';

let onChange = () => {};

/** @param {{ onChange?: (change: object) => void }} [options] */
export function initUI(options = {}) {
  onChange = options.onChange ?? onChange;
  initMenus();
  initLanguage();
  initTransportExtras();
  initHeaderChips();
  initRail();
  initSamplePanel();
  initBottomPanels();
  initAccordionButtons();
  initAgentAndSample();
  initSpectrum();
  initTrackMenu();
}

/* ───────── 아래 칸 (FR-2200) ───────── */

/**
 * 아래 칸 열기 — 'roll' · 'sample' · 'agent' · 'mixer' 중 하나만. 같은 것을 다시 열면 닫힘, null = 닫기
 * @param {'roll'|'sample'|'agent'|'mixer'|null} name
 */
export function openBottom(name) {
  const bottom = document.getElementById('bottom');
  const panel = name && document.getElementById(`panel-${name}`);
  if (!name || (!bottom.hidden && panel && !panel.hidden)) {
    bottom.hidden = true;
  } else if (name === 'roll') {
    openRoll();
  } else {
    bottom.hidden = false;
    bottom.querySelectorAll('.sq-panel').forEach((p) => { p.hidden = p !== panel; });
  }
  syncShortcutButtons();
}

/** 상단 창 바로가기 · 왼쪽 Mixer 버튼을 지금 열린 칸에 맞춤 */
function syncShortcutButtons() {
  const bottom = document.getElementById('bottom');
  const open = bottom.hidden ? null : [...bottom.querySelectorAll('.sq-panel')].find((p) => !p.hidden)?.dataset.panel;
  const sc = document.querySelectorAll('.sq-shortcuts button');
  sc.forEach((b) => {
    const t = b.title;
    const on = t.startsWith('Playlist') ? !open : t.startsWith('Piano') ? open === 'roll' : t.startsWith('Mixer') ? open === 'mixer' : false;
    b.setAttribute('aria-pressed', String(on));
  });
  document.getElementById('rail-mixer')?.setAttribute('aria-pressed', String(open === 'mixer'));
}

function initBottomPanels() {
  const bottom = document.getElementById('bottom');
  // ✕ 닫기 (피아노롤 ✕ 는 sequencer-roll.js 가 이미 닫음)
  bottom.addEventListener('click', (e) => { if (e.target.closest('.sq-bottom__close')) { bottom.hidden = true; syncShortcutButtons(); } });
  new MutationObserver(syncShortcutButtons).observe(bottom, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  // 믹서 머리줄 탭 Volume · Sends · I/O
  document.querySelector('#panel-mixer .sq-bottom__head')?.addEventListener('click', (e) => {
    const b = e.target.closest('button:not(.sq-bottom__close)');
    if (!b) return;
    b.parentElement.querySelectorAll('button:not(.sq-bottom__close)').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (b.textContent.trim() !== 'Volume') showToast(`${b.textContent.trim()} view comes with the mixer engine`);
  });
  // 창 바로가기 ▤ 🎹 🎚 ⤓
  document.querySelector('.sq-shortcuts')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const t = b.title;
    if (t.startsWith('Playlist')) openBottom(null);
    else if (t.startsWith('Piano')) openBottom('roll');
    else if (t.startsWith('Mixer')) openBottom('mixer');
    else if (t.startsWith('Export')) showToast('Export (WAV · MP3 · stems) comes with Phase 3');
  });
  document.getElementById('rail-mixer')?.addEventListener('click', () => openBottom('mixer'));
  // 키보드: Space = 재생/일시정지, Tab = 믹서
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); isPlaying() ? pausePlayback() : startPlayback(); }
    else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.shiftKey) { e.preventDefault(); openBottom('mixer'); }
  });
  // 오디오 클립 더블 클릭 → 샘플 설정
  document.getElementById('lanes')?.addEventListener('dblclick', (e) => {
    const clip = e.target.closest('.sq-clip--audio');
    if (!clip) return;
    const name = clip.querySelector('.sq-clip__name').textContent.replace(/^⇥\s*/, '').trim();
    const head = document.querySelector('#panel-sample .sq-bottom__head h2');
    if (head) head.textContent = `🎵 Sample settings — ${name}.wav`;
    const track = clip.closest('.sq-track')?.querySelector('.sq-track__name b')?.textContent.trim();
    const sub = document.querySelector('#panel-sample .sq-bottom__head span');
    if (sub && track) sub.textContent = `${track} · 48 kHz · Stereo`;
    const bottom = document.getElementById('bottom');
    bottom.hidden = false;
    bottom.querySelectorAll('.sq-panel').forEach((p) => { p.hidden = p.id !== 'panel-sample'; });
  });
}

/* ───────── 상단 메뉴 (FR-2241~2248) ───────── */

/** 이 모듈 · 다른 모듈이 실제로 처리하는 명령 — 나머지는 '아직' 안내 */
const HANDLED = new Set([
  'edit.delete', 'edit.selectAll', 'view.mixer', 'view.roll', 'view.sample', 'view.automation', 'view.files', 'view.collab',
  'view.followPage', 'view.followScroll', 'view.zoomIn', 'view.zoomOut', 'view.zoomFit', 'view.timeFormat', 'view.nyxi', 'view.nyxiDance',
  'view.tracksTaller', 'view.tracksShorter', 'view.tracksReset', 'options.triplet', 'options.metronome', 'options.countIn',
  'track.addMidi', 'track.addAudio', 'track.addReturn', 'track.addGroup', 'track.groupSelected', 'marker.add', 'window.close', 'help.shortcuts', 'project.save',
]);

/** 이 모듈이 처리하는 명령 */
const COMMANDS = {
  'edit.selectAll': () => document.querySelectorAll('#lanes .sq-clip:not(.is-ghost)').forEach((c) => c.classList.add('is-selected')),
  'view.mixer': () => openBottom('mixer'),
  'view.roll': () => openBottom('roll'),
  'view.sample': () => openBottom('sample'),
  'view.files': () => { const side = document.querySelector('.sq-side'); side.hidden = !side.hidden; document.body.classList.toggle('is-no-side', side.hidden); },
  'view.collab': () => toggleCollab(),
  'view.timeFormat': () => document.getElementById('time')?.click(),
  'view.nyxi': () => { const n = document.getElementById('nyxi'); n.hidden = !n.hidden; },
  'view.nyxiDance': () => document.body.classList.toggle('is-no-dance'),
  'options.metronome': () => showToast('Metronome sound comes with the audio engine'),
  'options.countIn': () => showToast('Count-in comes with the audio engine'),
  'track.addMidi': () => addTrack('MIDI'),
  'track.addAudio': () => addTrack('AUDIO'),
  'track.addReturn': () => addTrack('RETURN'),
  'track.addGroup': () => { addGroup(); showToast('New group track added — select tracks and press Ctrl+G to group them'); },
  'track.groupSelected': () => groupTracks(),
  'window.close': () => window.close(),
  'help.shortcuts': () => showToast('P B D T S C E tools · A automation · Z fit · Space play · Tab mixer · Delete remove · Ctrl+wheel zoom', 6000),
  'project.save': () => showToast('Saving needs the server — not connected yet'),
};

/* ───────── 트랙 선택 · 그룹 (FR-207 그룹 · FR-2210) ───────── */

/** 선택한 트랙들을 그룹으로 (Ctrl+G · 오른쪽 클릭 메뉴 · ADD 메뉴) */
function groupTracks() {
  const n = selectedTracks().length;
  const g = groupSelectedTracks();
  if (!g) return;
  showToast(n ? `Grouped ${n} track${n === 1 ? '' : 's'}` : 'New group track added');
}

/** 선택한 그룹 트랙 풀기 */
function ungroupSelection() {
  const n = ungroupTracks();
  showToast(n ? `Ungrouped ${n} group${n === 1 ? '' : 's'}` : 'Select a group track first');
}

/** 선택한 트랙 지우기 */
function deleteTracks() {
  const n = selectedTracks().length;
  if (!n) return;
  deleteSelectedTracks();
  showToast(`Deleted ${n} track${n === 1 ? '' : 's'}`);
}

/** 트랙 머리 오른쪽 클릭 = 작은 메뉴 (그룹으로 묶기 · 그룹 풀기 · 트랙 지우기) */
function openTrackMenu(x, y) {
  document.querySelector('.sq-trackmenu')?.remove();
  const n = selectedTracks().length;
  const hasGroup = selectedTracks().some((t) => t.classList.contains('sq-track--group'));
  const ul = document.createElement('ul');
  ul.className = 'sq-dropdown is-popup sq-trackmenu';
  ul.setAttribute('role', 'menu');
  ul.innerHTML = `
    <li><button type="button" role="menuitem" data-act="group"${n ? '' : ' disabled'}>Group selected tracks <kbd>Ctrl+G</kbd></button></li>
    <li><button type="button" role="menuitem" data-act="ungroup"${hasGroup ? '' : ' disabled'}>Ungroup <kbd></kbd></button></li>
    <li role="separator"><hr></li>
    <li><button type="button" role="menuitem" data-act="delete">Delete track <kbd>Del</kbd></button></li>`;
  ul.style.position = 'fixed';
  ul.style.left = `${Math.min(x, window.innerWidth - 230)}px`;
  ul.style.top = `${Math.min(y, window.innerHeight - 150)}px`;
  document.body.append(ul);
  const off = (e) => { if (!ul.contains(e.target)) close(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    ul.remove();
    document.removeEventListener('pointerdown', off);
    document.removeEventListener('keydown', esc);
  }
  ul.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    close();
    if (act === 'group') groupTracks();
    else if (act === 'ungroup') ungroupSelection();
    else if (act === 'delete') deleteTracks();
  });
  setTimeout(() => { document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc); });
}

function initTrackMenu() {
  const lanes = document.getElementById('lanes');
  if (!lanes) return;
  // 트랙 머리에서 오른쪽 클릭 = 그 트랙 선택 후 메뉴
  lanes.addEventListener('contextmenu', (e) => {
    const head = e.target.closest('.sq-track__head');
    const track = head?.closest('.sq-track');
    if (!track || e.target.closest('button')) return;
    e.preventDefault();
    if (!track.classList.contains('is-selected')) selectTrack(track);
    openTrackMenu(e.clientX, e.clientY);
  });
  // Ctrl+G = 선택 트랙 그룹화 · Ctrl+Shift+G = 그룹 풀기
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'g') return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (e.shiftKey) ungroupSelection(); else groupTracks();
  });
}

function initMenus() {
  const top = document.querySelector('.sq-top');
  const items = [...document.querySelectorAll('.sq-menu__item[aria-controls]')];
  let openBtn = null;
  const close = () => {
    if (!openBtn) return;
    openBtn.setAttribute('aria-expanded', 'false');
    document.getElementById(openBtn.getAttribute('aria-controls')).hidden = true;
    openBtn = null;
  };
  const open = (btn) => {
    close();
    const menu = document.getElementById(btn.getAttribute('aria-controls'));
    const r = btn.getBoundingClientRect();
    const t = top.getBoundingClientRect();
    menu.style.left = `${r.left - t.left}px`;
    menu.style.top = `${r.bottom - t.top + 2}px`;
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openBtn = btn;
  };
  items.forEach((btn) => {
    btn.addEventListener('click', () => (openBtn === btn ? close() : open(btn)));
    btn.addEventListener('pointerenter', () => { if (openBtn && openBtn !== btn) open(btn); });   // 열린 채 옆 메뉴로
  });
  // 항목 누르기 → 명령 실행 후 닫기
  top.addEventListener('click', (e) => {
    const item = e.target.closest('.sq-dropdown [data-command]');
    if (!item || !item.closest('[data-menu]')) return;
    const cmd = item.dataset.command;
    COMMANDS[cmd]?.();
    if (item.getAttribute('role') === 'menuitemcheckbox' && !cmd.startsWith('options.triplet')) item.setAttribute('aria-checked', String(item.getAttribute('aria-checked') !== 'true'));
    if (!HANDLED.has(cmd)) showToast(`${item.firstChild.textContent.trim()} — not available yet`);
    onChange({ type: 'command', command: cmd });
    close();
  });
  document.addEventListener('pointerdown', (e) => { if (openBtn && !e.target.closest('.sq-menu, .sq-dropdown')) close(); });
  document.addEventListener('keydown', (e) => {
    if (!openBtn) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = items.indexOf(openBtn);
      open(items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length]);
    }
  });
}

/* ───────── 언어 EN / KO / JA (FR-2171) ───────── */

const LANG_KEY = 'studionx.sequencer.lang';
let dict = null;
let lang = 'en';
const original = new WeakMap();   // 글자 노드 · placeholder 의 처음 영어

async function loadDict() {
  if (!dict) dict = await (await fetch('static/i18n/sequencer.json')).json();
  return dict;
}

function translateTree(root) {
  if (!dict) return;
  const tr = (t) => {
    if (dict.text[t]) return dict.text[t][lang];
    for (const p of dict.prefix) { const re = new RegExp(p.pattern); if (re.test(t)) return t.replace(re, p[lang]); }
    return null;
  };
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    const el = n.parentElement;
    if (!el || el.closest(dict.skip) || el.closest('script, style')) continue;
    if (!original.has(n)) original.set(n, n.nodeValue);
    const en = original.get(n);
    const t = en.trim();
    if (!t) continue;
    const v = lang === 'en' ? null : tr(t);
    n.nodeValue = v == null ? en : en.replace(t, v);
  }
  (root.querySelectorAll ? root.querySelectorAll('[placeholder]') : []).forEach((el) => {
    if (!original.has(el)) original.set(el, el.placeholder);
    const en = original.get(el);
    el.placeholder = (lang !== 'en' && tr(en)) || en;
  });
}

/**
 * 시퀀서 언어 바꾸기 — 화면 글자만 (트랙 · 파일 이름, 채팅 등은 그대로)
 * @param {'en'|'ko'|'ja'} next
 */
export async function setLanguage(next) {
  lang = ['en', 'ko', 'ja'].includes(next) ? next : 'en';
  await loadDict();
  document.documentElement.lang = lang;
  translateTree(document.body);
  const btn = document.getElementById('lang-button');
  if (btn) btn.textContent = dict.labels[lang];
  document.querySelectorAll('#menu-lang [data-lang]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* 이 창에서만 */ }
  onChange({ type: 'language', lang });   // 정식 저장은 PATCH /api/v1/me/settings
}

function initLanguage() {
  const btn = document.getElementById('lang-button');
  const menu = document.getElementById('menu-lang');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const show = menu.hidden;
    menu.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    setLanguage(b.dataset.lang);
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  // 새로 생긴 글자(새 트랙 · 힌트 바 · 알림 …)도 지금 언어로
  new MutationObserver((list) => {
    if (lang === 'en' || !dict) return;
    list.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) translateTree(n); else if (n.nodeType === 3 && n.parentElement) translateTree(n.parentElement); }));
  }).observe(document.body, { childList: true, subtree: true });
  let saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch { /* 없음 */ }
  if (saved && saved !== 'en') setLanguage(saved);
}

/* ───────── 상단: PAT/SONG · BPM · 시간 · 💬 · Nyxi ───────── */

function initTransportExtras() {
  // PAT / SONG
  const pat = document.getElementById('mode-pat');
  const song = document.getElementById('mode-song');
  const setMode = (m) => {
    pat?.setAttribute('aria-pressed', String(m === 'pattern'));
    song?.setAttribute('aria-pressed', String(m === 'song'));
    document.body.classList.toggle('is-pattern-mode', m === 'pattern');
    onChange({ type: 'playMode', mode: m });
  };
  pat?.addEventListener('click', () => { setMode('pattern'); showToast('Pattern mode — ▶ will play only the selected pattern (with the audio engine)'); });
  song?.addEventListener('click', () => setMode('song'));

  // BPM — 눌러서 바로 입력 (20 ~ 999), Enter = 확정, Esc = 취소
  const bpm = document.getElementById('bpm');
  bpm?.addEventListener('click', () => {
    if (bpm.querySelector('input')) return;
    const before = bpm.textContent;
    const input = document.createElement('input');
    input.className = 'sq-bpm-input sq-num';
    input.type = 'number';
    input.min = '20';
    input.max = '999';
    input.step = '0.001';
    input.value = parseFloat(before);
    bpm.textContent = '';
    bpm.append(input);
    input.focus();
    input.select();
    let closed = false;
    const done = (ok) => {
      if (closed) return;
      closed = true;
      const v = Math.min(999, Math.max(20, parseFloat(input.value)));
      bpm.textContent = ok && Number.isFinite(v) ? v.toFixed(3) : before;
      const n = parseFloat(bpm.textContent);
      document.body.style.setProperty('--bpm', n);
      document.querySelectorAll('.sq-nyxi span').forEach((s) => { s.textContent = `♪ ${Math.round(n)} BPM`; });
      setPlayheadBar(getPlayheadBar());   // 시간 표시 다시
      if (ok) onChange({ type: 'bpm', bpm: n });
    };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    input.addEventListener('blur', () => done(true));
    input.addEventListener('click', (e) => e.stopPropagation());
  });

  // 시간 표시 — 누르면 분:초 ⇄ 마디
  const time = document.getElementById('time');
  time?.addEventListener('click', () => {
    time.dataset.mode = time.dataset.mode === 'bars' ? 'time' : 'bars';
    const [s1, s2] = time.querySelectorAll('small');
    if (s1 && s2) [s1.textContent, s2.textContent] = [s2.textContent, s1.textContent];
    setPlayheadBar(getPlayheadBar());
  });
  setPlayheadBar(getPlayheadBar());

  // 💬 · Nyxi
  document.getElementById('chat-button')?.addEventListener('click', () => toggleCollab(true));
  document.getElementById('nyxi-button')?.addEventListener('click', () => openBottom('agent'));
  document.getElementById('nyxi')?.addEventListener('dblclick', () => openBottom('agent'));
}

/* ───────── 상단 2줄: Pattern ▾ · ＋ · Key ▾ ───────── */

/** 버튼 아래에 작은 선택 메뉴 */
function popup(btn, list, current, pick) {
  document.querySelector('.sq-dropdown.is-popup')?.remove();
  const top = document.querySelector('.sq-top');
  const ul = document.createElement('ul');
  ul.className = 'sq-dropdown is-popup';
  ul.setAttribute('role', 'menu');
  ul.innerHTML = list.map((v) => `<li><button type="button" role="menuitemradio" aria-checked="${v === current}">${v}</button></li>`).join('');
  const r = btn.getBoundingClientRect();
  const t = top.getBoundingClientRect();
  ul.style.left = `${Math.min(r.left - t.left, t.width - 220)}px`;
  ul.style.top = `${r.bottom - t.top + 2}px`;
  ul.style.maxHeight = '22rem';
  ul.style.overflowY = 'auto';
  top.append(ul);
  ul.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { pick(b.textContent); ul.remove(); } });
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!ul.contains(e.target)) { ul.remove(); document.removeEventListener('pointerdown', off); } }));
}

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap((k) => [`${k} major`, `${k} minor`]);

function initHeaderChips() {
  const patBtn = document.getElementById('pattern-select');
  const items = () => [...document.querySelectorAll('#pattern-list .sq-file')];
  patBtn?.addEventListener('click', () => {
    const cur = patBtn.textContent.replace(/^Pattern:\s*/, '').replace(/\s*▾$/, '');
    popup(patBtn, items().map((i) => i.dataset.name), cur, (name) => {
      const it = items().find((i) => i.dataset.name === name);
      setDrawTemplate({ kind: 'midi', name, length: parseFloat(it?.dataset.bars) || 4 });
    });
  });
  // ＋ 새 패턴 — 패턴 목록에 'Pattern N'(4마디)을 넣고 Draw 로 놓을 것으로
  document.getElementById('pattern-new')?.addEventListener('click', () => {
    const list = document.getElementById('pattern-list');
    const n = items().length + 1;
    const name = `Pattern ${n}`;
    const li = document.createElement('li');
    li.className = 'sq-file sq-pattern';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.draggable = true;
    Object.assign(li.dataset, { kind: 'midi', name, bars: '4', color: String(((n - 1) % 5) + 1) });
    li.innerHTML = `<span>▤</span><span class="sq-file__name">${name}</span><span class="sq-file__meta sq-num">4 bar</span>`;
    list.append(li);
    setDrawTemplate({ kind: 'midi', name, length: 4 });
    showToast(`${name} added to Patterns — draw it with P`);
    onChange({ type: 'patternNew', name });
  });
  const key = document.getElementById('key');
  key?.addEventListener('click', () => {
    const cur = key.textContent.replace(/^Key:\s*/, '').replace(/\s*▾$/, '');
    popup(key, KEYS, cur, (k) => {
      key.textContent = `Key: ${k} ▾`;
      const dd = [...document.querySelectorAll('.sq-roll__props div')].find((d) => d.querySelector('dt')?.textContent === 'Scale')?.querySelector('dd');
      if (dd) dd.textContent = k;
      onChange({ type: 'key', key: k });
    });
  });
  document.getElementById('chord')?.addEventListener('click', () => showToast('Chord detection comes with the audio engine'));
}

/* ───────── 왼쪽: 카테고리 · 필터 · 검색 · 업로드 · 협업 ───────── */

/** Samples · Patterns 말고 다른 카테고리의 예시 목록 (서버 연결 전) */
const CATEGORY_LISTS = {
  presets: ['Soft Pluck Pad|Wavetable', 'Supersaw Chord|Wavetable', 'Glass Bell|Operator', 'Square Lead|Analog', 'Sub Sine|Operator', 'Wobble Bass|Wavetable'],
  plugins: ['Wavetable|Instrument', 'Operator|Instrument', 'Analog|Instrument', 'Drum Rack|Instrument', 'Arpeggiator|MIDI FX', 'EQ Eight|Effect', 'Compressor|Effect', 'Reverb|Effect', 'Delay|Effect', 'Limiter|Effect'],
  automation: ['Filter rise 8bar|8 bar', 'Volume duck 1/4|1 bar', 'Reverb mix swell|4 bar', 'Pan sweep|2 bar'],
  records: ['Take 1 — Vocal|0:12', 'Take 2 — Vocal|0:11'],
  reference: ['Midnight Drive|YouTube'],
  favorites: ['kick_808_punch.wav|Sample', 'Supersaw Chord|Preset', 'Reverb|Effect'],
};
const TITLES = { presets: 'Presets', plugins: 'Plugins', automation: 'Automation', records: 'Records', reference: 'Reference', favorites: 'Favorites' };
const FILTERS = { Drums: /kick|snare|hat|drum|perc/i, Bass: /bass|808|sub/i, FX: /riser|fx|sweep|impact/i, Vocal: /vox|vocal/i, Loops: /loop/i, 'My uploads': /./ };

function visibleList() {
  return [...document.querySelectorAll('.sq-files .sq-filelist')].find((l) => !l.hidden);
}

/** 목록 거르기 — Samples(#file-list) 는 서버 데이터라 applySampleFilters 로, 나머지 생성 목록은 여기서 */
function applyFilters() {
  const list = visibleList();
  if (!list) return;
  if (list.id === 'file-list') { applySampleFilters(); return; }
  const searchEl = document.getElementById('file-search');
  const q = (searchEl && searchEl.value ? searchEl.value : '').trim().toLowerCase();
  let shown = 0;
  list.querySelectorAll('.sq-file').forEach((li) => {
    const nameEl = li.querySelector('.sq-file__name');
    const name = nameEl ? nameEl.textContent : '';
    const ok = !q || name.toLowerCase().includes(q);
    li.hidden = !ok;
    if (ok) shown += 1;
  });
  const count = document.querySelector('.sq-files__count');
  if (count) count.textContent = `${shown} items`;
}

function toggleCollab(force) {
  const panel = document.getElementById('collab');
  const show = force ?? panel.hidden;
  panel.hidden = !show;
  document.getElementById('rail-members')?.setAttribute('aria-pressed', String(show));
  document.getElementById('rail-chat')?.setAttribute('aria-pressed', String(show));
  if (show) {
    document.querySelector('#rail-chat .sq-rail__count')?.remove();   // 읽음
    panel.querySelector('.sq-chat__input')?.focus();
  }
}

function initRail() {
  const rail = document.querySelector('.sq-rail');
  rail?.addEventListener('click', (e) => {
    const btn = e.target.closest('.sq-rail__btn[data-category]');
    if (!btn) return;
    const cat = btn.dataset.category;
    // Samples · Patterns 는 sequencer-arrange.js 가 바꿈 → 여기서는 다른 카테고리 목록을 숨기기만
    document.querySelectorAll('.sq-filelist[data-generated]').forEach((l) => { l.hidden = true; });
    if (CATEGORY_LISTS[cat]) {
      document.querySelectorAll('.sq-rail__btn[data-category]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      document.getElementById('file-list').hidden = true;
      document.getElementById('pattern-list').hidden = true;
      let ul = document.getElementById(`list-${cat}`);
      if (!ul) {
        ul = document.createElement('ul');
        ul.className = 'sq-filelist';
        ul.id = `list-${cat}`;
        ul.dataset.generated = '';
        ul.setAttribute('role', 'listbox');
        ul.innerHTML = CATEGORY_LISTS[cat].map((row) => {
          const [name, meta] = row.split('|');
          return `<li class="sq-file" role="option" aria-selected="false"><span>${{ presets: '🎛', plugins: '🔌', automation: '⤴', records: '🎙', reference: '🎧', favorites: '★' }[cat]}</span><span class="sq-file__name">${name}</span><span class="sq-file__meta">${meta}</span></li>`;
        }).join('');
        document.getElementById('drop-zone').before(ul);
      }
      ul.hidden = false;
      document.getElementById('files-title').textContent = TITLES[cat];
      document.querySelector('.sq-filters').hidden = true;
      const search = document.getElementById('file-search');
      if (search) search.placeholder = `Search ${TITLES[cat].toLowerCase()} (Ctrl+F)`;
    }
    applyFilters();
  });
  // 목록 항목 클릭 = 선택 (샘플 · 패턴이면 Draw 로 놓을 것)
  document.querySelector('.sq-files')?.addEventListener('click', (e) => {
    const li = e.target.closest('.sq-file');
    if (!li) return;
    li.closest('.sq-filelist').querySelectorAll('.sq-file[aria-selected="true"]').forEach((x) => x.setAttribute('aria-selected', 'false'));
    li.setAttribute('aria-selected', 'true');
    if (li.dataset.kind) setDrawTemplate({ kind: li.dataset.kind, name: li.dataset.name, length: parseFloat(li.dataset.bars) || 1 });
    if (li.classList.contains('is-missing')) showToast('Relinking missing files needs the server');
  });
  // 검색·필터 · 업로드 · 드롭 존은 initSamplePanel (S1-07) 이 맡음
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('file-search')?.focus(); }
  });
  // 협업 패널 · 채팅
  document.getElementById('rail-members')?.addEventListener('click', () => toggleCollab());
  document.getElementById('rail-chat')?.addEventListener('click', () => toggleCollab());
  document.querySelector('#collab .sq-upload')?.addEventListener('click', () => showToast('Inviting members comes with Phase 6'));
  const chatIn = document.querySelector('.sq-chat__input');
  chatIn?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Enter' || !chatIn.value.trim()) return;
    const p = document.createElement('p');
    p.className = 'sq-chat__msg';
    const t = new Date();
    p.innerHTML = '<b style="color:#a383ff">taemin</b>';
    p.append(document.createTextNode(chatIn.value.trim()));
    const time = document.createElement('time');
    time.textContent = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    p.append(time);
    chatIn.before(p);
    onChange({ type: 'chat', text: chatIn.value.trim() });
    chatIn.value = '';
  });
}

/* ───────── 왼쪽: 샘플 라이브러리 (S1-07, FR-221~227) ─────────
   core/api.js 의 API 함수(193~200)를 불러 목록 · 태그 · 파형 · 미리듣기 · 업로드 · 이름 · 태그 · 삭제 · 저장 용량을
   담당합니다. 화면 함수 번호는 201~210 입니다. 선택자(#file-list, .sq-file, .sq-file__wave, .sq-filters, #drop-zone,
   #upload-list …)는 studioNx.html · studio.css 와 맞춰 둔 이름이라 바꾸지 않습니다. */

// 화면이 기억하는 값 — 목록 · 태그 · 재생 중 샘플 · 저장 용량
const sampleState = {
  items: [],
  total: 0,
  tags: [],
  filterTag: null,     // ＋ Tag 로 고른 태그 이름 (없으면 null)
  playingId: null,     // 재생 중인 샘플 번호 (없으면 null)
  audio: null,         // 재생 중인 <audio> 하나 (동시에 하나만)
  usedBytes: 0,        // 목록 file_size 합 — 남은 용량 API(FR-134)가 생기면 그 값으로 바꿈
  limitBytes: 1024 * 1024 * 1024,
};
let sampleFilterTimer = 0;

/**
 * 201. 라이브러리 패널 시작 (FR-221~227)
 * - 태그 목록(200) → 목록(193) 순서로 부르고, 하나가 실패해도 패널은 그대로 씁니다
 * - 검색 · 필터 · 업로드 · 드롭 · 빈 목록 버튼을 모두 여기서 연결합니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
async function initSamplePanel() {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;
  const uploadEl = document.getElementById('upload-list');
  if (uploadEl) { uploadEl.textContent = ''; uploadEl.hidden = true; }   // 목업 예시 줄 비우기
  bindSamplePanelEvents();
  readStorageLimit();
  try {
    const tagRes = await fetchTags();
    sampleState.tags = tagRes && tagRes.items ? tagRes.items : [];
  } catch (e) {
    sampleState.tags = [];   // 태그가 없어도 목록은 보여 줍니다
  }
  await loadSampleList();
}

/** 목록 불러와 그리기 — 실패해도 화면에 있던 예시 줄은 지우지 않습니다 */
async function loadSampleList() {
  try {
    const res = await fetchSampleList({ size: 50 });
    renderSampleList(res && res.items ? res.items : [], res ? res.total : 0);
  } catch (e) {
    if (!e || e.status !== 401) showToast('Could not load your samples');
  }
}

/**
 * 202. 샘플 목록 그리기 (FR-224)
 * @param {object[]} items  SampleResponse 배열 (태그 포함)
 * @param {number} total    서버가 알려 준 전체 개수
 * - 한 줄마다 재생 버튼 · 아이콘 · 이름+태그 · 길이/키 · 파형 · 삭제 버튼을 만듭니다
 * - 전부 그리면 거르기(204)를 한 번 돌려 검색·필터 상태와 맞춥니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
function renderSampleList(items, total) {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;
  sampleState.items = items;
  sampleState.total = total;
  listEl.textContent = '';
  items.forEach((item) => listEl.appendChild(sampleRow(item)));
  sampleState.usedBytes = items.reduce((sum, item) => sum + (item.file_size ? item.file_size : 0), 0);
  updateStorageBar(sampleState.usedBytes, sampleState.limitBytes);
  applySampleFilters();
}

/** 목록 한 줄 만들기 — studioNx.html 의 li.sq-file 과 같은 모양 */
function sampleRow(item) {
  const li = document.createElement('li');
  li.className = 'sq-file';
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', 'false');
  li.setAttribute('draggable', 'true');
  li.dataset.kind = 'audio';
  li.dataset.sampleId = String(item.sample_id);
  li.dataset.name = item.name;
  li.dataset.bars = String(sampleBars(item.duration_ms));

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'sq-file__play';
  play.setAttribute('aria-label', 'Preview ' + item.name);
  play.textContent = '▶';
  li.appendChild(play);

  const icon = document.createElement('span');
  icon.className = 'sq-file__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = sampleIcon(item);
  li.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'sq-file__title';
  const name = document.createElement('span');
  name.className = 'sq-file__name';
  name.textContent = item.name;
  title.appendChild(name);
  const tags = document.createElement('span');
  tags.className = 'sq-file__tags';
  const itemTags = item.tags ? item.tags : [];
  itemTags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = tag.category === 'GENRE' ? 'sq-file__tag is-genre' : 'sq-file__tag';
    chip.textContent = tag.name;
    tags.appendChild(chip);
  });
  title.appendChild(tags);
  li.appendChild(title);

  const meta = document.createElement('span');
  meta.className = 'sq-file__meta sq-num';
  meta.textContent = sampleMeta(item);
  li.appendChild(meta);

  const wave = document.createElement('span');
  wave.className = 'sq-file__wave';
  const fill = document.createElement('i');
  fill.style.setProperty('--p', '0%');
  wave.appendChild(fill);
  li.appendChild(wave);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'sq-file__del';
  del.setAttribute('aria-label', 'Delete ' + item.name);
  del.textContent = '×';
  li.appendChild(del);

  drawSampleWaveform(li);
  return li;
}

/** 이름과 태그로 아이콘 하나 고르기 */
function sampleIcon(item) {
  const tags = item.tags ? item.tags.map((t) => t.name).join(' ') : '';
  const text = (item.name + ' ' + tags).toLowerCase();
  if (/kick|snare|hat|drum|perc|clap|tom/.test(text)) return '🥁';
  if (/vox|vocal|voice/.test(text)) return '🎤';
  if (/bass|sub|808/.test(text)) return '🔊';
  if (/gtr|guitar|strum/.test(text)) return '🎸';
  if (/pad|key|piano|chord/.test(text)) return '🎹';
  if (/riser|sweep|fx|impact|hit|transition/.test(text)) return '✨';
  if (/loop/.test(text)) return '🔁';
  return '🎵';
}

/** 길이(0:05) · 조성(C) · BPM(145) 을 이어 붙인 한 줄 */
function sampleMeta(item) {
  const parts = [];
  parts.push(item.duration_ms ? formatDuration(item.duration_ms) : '--:--');
  if (item.music_key) parts.push(item.music_key);
  if (item.bpm) parts.push(String(item.bpm));
  return parts.join(' · ');
}

/** 밀리초 → 분:초 */
function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/** 길이를 마디로 (120 BPM · 4/4 에서 1마디 = 2초) — 트랙에 끌어 놓을 때 클립 길이 */
function sampleBars(ms) {
  if (!ms) return 1;
  return Math.max(0.25, Math.round((ms / 2000) * 4) / 4);
}

/**
 * 203. 목록 줄의 파형 그리기 (FR-223) — GET /samples/{id}/waveform 의 peaks 를 캔버스에
 * - 파형이 아직 없거나 실패하면 아무것도 하지 않아 세로 무늬(마스크)가 그대로 남습니다
 * - 캔버스는 줄마다 한 번 만들고, 그 뒤 다시 그릴 때는 같은 캔버스를 씁니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
async function drawSampleWaveform(row) {
  const wave = row.querySelector('.sq-file__wave');
  const id = row.dataset.sampleId;
  if (!wave || !id) return;
  let data = null;
  try {
    data = await fetchSampleWaveform(id);
  } catch (e) {
    return;
  }
  const peaks = data && data.peaks ? data.peaks : null;
  if (!peaks || !peaks.length) return;
  let canvas = wave.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'sq-file__wave__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    wave.insertBefore(canvas, wave.firstChild);
    wave.classList.add('has-wave');
  }
  drawPeaks(canvas, peaks, window.getComputedStyle(wave).color);
}

/** peaks([최솟값, 최댓값]) 를 캔버스에 세로 막대로 그림 (화면 배율 반영) */
function drawPeaks(canvas, peaks, color) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  ctx.fillStyle = color || 'currentColor';
  const step = peaks.length / w;
  for (let x = 0; x < w; x++) {
    const peak = peaks[Math.min(peaks.length - 1, Math.floor(x * step))];
    const lo = peak && peak.length ? peak[0] : 0;
    const hi = peak && peak.length ? peak[1] : 0;
    const top = mid - hi * mid;
    const bot = mid - lo * mid;
    ctx.fillRect(x, Math.max(0, top), 1, Math.max(1, bot - top));
  }
}

/**
 * 204. 목록 거르기 (FR-224) — 검색어 · 필터 칩 · 고른 태그로 줄을 숨기고 개수를 셉니다
 * - 검색어가 # 로 시작하면 태그 이름에서, 아니면 샘플 이름에서 찾습니다
 * - 필터 칩(Drums/Bass/…)은 기존 FILTERS 정규식을 이름에 겁니다
 * - 0건일 때 빈 목록/결과 없음을 toggleEmptyState 로 보여 줍니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
function applySampleFilters() {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;
  const searchEl = document.getElementById('file-search');
  const q = (searchEl && searchEl.value ? searchEl.value : '').trim().toLowerCase();
  const chip = document.querySelector('.sq-filters [aria-pressed="true"]');
  const chipName = chip && chip.textContent ? chip.textContent.trim() : '';
  const re = FILTERS[chipName] ? FILTERS[chipName] : null;
  const tagName = sampleState.filterTag ? sampleState.filterTag.toLowerCase() : null;
  const byTag = q.charAt(0) === '#';
  let shown = 0;
  listEl.querySelectorAll('.sq-file').forEach((li) => {
    const nameEl = li.querySelector('.sq-file__name');
    const name = nameEl ? nameEl.textContent.toLowerCase() : '';
    const tags = Array.prototype.map.call(li.querySelectorAll('.sq-file__tag'), (t) => t.textContent.toLowerCase());
    let ok = true;
    if (q) {
      ok = byTag ? tags.some((t) => t.indexOf(q.slice(1)) !== -1) : name.indexOf(q) !== -1;
    }
    if (ok && re && !re.test(name)) ok = false;
    if (ok && tagName && tags.indexOf(tagName) === -1) ok = false;
    li.hidden = !ok;
    if (ok) shown += 1;
  });
  const count = document.querySelector('.sq-files__count');
  if (count) count.textContent = `${shown} items`;
  toggleEmptyState(sampleState.items.length, shown);
}

/**
 * 209. 빈 목록 · 결과 없음 상태 보이기 (FR-221·224)
 * @param {number} total  전체 샘플 수
 * @param {number} shown  거른 뒤 보이는 수
 * - total 이 0이면 빈 목록, total 은 있는데 shown 이 0이면 결과 없음을 보입니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
function toggleEmptyState(total, shown) {
  const empty = document.getElementById('files-empty');
  const none = document.getElementById('files-noresults');
  if (!empty || !none) return;
  empty.hidden = total > 0;
  const noResults = total > 0 && shown === 0;
  none.hidden = !noResults;
  if (noResults) {
    const query = document.getElementById('noresults-query');
    const searchEl = document.getElementById('file-search');
    if (query) query.textContent = searchEl ? searchEl.value.trim() : '';
  }
}

/**
 * 205. 미리듣기 켜기/끄기 (FR-224) — 줄의 ▶ 를 누르면 재생, 다시 누르면 멈춤
 * - 한 번에 한 샘플만 재생합니다. 파형 채움(--p)은 재생 위치에 맞춰 찹니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
async function toggleSamplePreview(row) {
  const id = row.dataset.sampleId;
  if (!id) return;
  if (sampleState.playingId === id) { stopSamplePreview(); return; }
  stopSamplePreview();
  let url = null;
  try {
    url = await fetchSampleFileUrl(id);
  } catch (e) {
    showToast('Could not load the sample');
    return;
  }
  const audio = new Audio(url);
  sampleState.audio = audio;
  sampleState.playingId = id;
  row.classList.add('is-playing');
  setSamplePlayGlyph(row, true);
  const fill = row.querySelector('.sq-file__wave i');
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const p = Math.min(100, (audio.currentTime / audio.duration) * 100);
    if (fill) fill.style.setProperty('--p', p.toFixed(1) + '%');
  });
  audio.addEventListener('ended', () => stopSamplePreview());
  const played = audio.play();
  if (played && played.catch) played.catch(() => stopSamplePreview());
}

/** 미리듣기 멈추기 — 재생 중 화면 상태를 되돌립니다 */
function stopSamplePreview() {
  const id = sampleState.playingId;
  if (sampleState.audio) { sampleState.audio.pause(); sampleState.audio = null; }
  sampleState.playingId = null;
  if (id == null) return;
  const listEl = document.getElementById('file-list');
  const row = listEl ? listEl.querySelector('.sq-file[data-sample-id="' + id + '"]') : null;
  if (!row) return;
  row.classList.remove('is-playing');
  setSamplePlayGlyph(row, false);
  const fill = row.querySelector('.sq-file__wave i');
  if (fill) fill.style.setProperty('--p', '0%');
}

/** 재생 버튼 글자(▶ / ❚❚)와 설명 바꾸기 */
function setSamplePlayGlyph(row, playing) {
  const btn = row.querySelector('.sq-file__play');
  if (!btn) return;
  btn.textContent = playing ? '❚❚' : '▶';
  btn.setAttribute('aria-label', (playing ? 'Pause ' : 'Preview ') + (row.dataset.name || 'sample'));
}

/**
 * 206. 업로드 줄 세우기 (FR-226) — 고른/떨어뜨린 파일들을 하나씩 올립니다
 * - 파일마다 진행 줄(207)을 만들고, 진행률은 uploadSample 의 progress 로 채웁니다
 * - 취소(×)를 누르면 AbortController 로 그 파일 업로드만 멈춥니다
 * - 끝나면 줄을 지우고, 성공이면 목록 맨 위에 새 샘플을 넣고 저장 용량을 더합니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
function uploadQueue(fileList) {
  const listEl = document.getElementById('upload-list');
  if (!listEl) return;
  const files = Array.prototype.slice.call(fileList);
  if (!files.length) return;
  listEl.hidden = false;
  files.forEach((file) => {
    const row = renderUploadRow(file);
    const controller = new AbortController();
    const cancel = row.querySelector('.sq-upload-row__cancel');
    if (cancel) cancel.addEventListener('click', () => controller.abort());
    uploadSample(file, {
      signal: controller.signal,
      onProgress: (loaded, total) => setUploadProgress(row, loaded, total),
    }).then((sample) => {
      row.remove();
      if (!listEl.children.length) listEl.hidden = true;
      if (sample) {
        prependSampleRow(sample);
        sampleState.usedBytes += sample.file_size ? sample.file_size : 0;
        sampleState.total += 1;
        updateStorageBar(sampleState.usedBytes, sampleState.limitBytes);
        applySampleFilters();
      }
      showToast(file.name + ' uploaded');
    }).catch((err) => {
      if (err && err.code === 'ABORTED') {
        row.remove();
      } else {
        row.classList.add('is-error');
        const em = row.querySelector('em');
        if (em) em.textContent = uploadErrorMessage(err);
      }
      if (!listEl.children.length) listEl.hidden = true;
    });
  });
}

/**
 * 207. 업로드 진행 줄 하나 만들기 (FR-226) — #upload-list 에 li.sq-upload-row 를 붙여 돌려줍니다
 * @returns {HTMLLIElement}
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
function renderUploadRow(file) {
  const listEl = document.getElementById('upload-list');
  const li = document.createElement('li');
  li.className = 'sq-upload-row';

  const icon = document.createElement('span');
  icon.className = 'sq-upload-row__ic';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🎵';
  li.appendChild(icon);

  const name = document.createElement('b');
  name.textContent = file.name;
  li.appendChild(name);

  const state = document.createElement('em');
  state.textContent = '0%';
  li.appendChild(state);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'sq-upload-row__cancel';
  cancel.setAttribute('aria-label', 'Cancel upload');
  cancel.textContent = '×';
  li.appendChild(cancel);

  const bar = document.createElement('span');
  bar.className = 'sq-upload-row__bar';
  const fill = document.createElement('i');
  fill.style.setProperty('--p', '0%');
  bar.appendChild(fill);
  li.appendChild(bar);

  if (listEl) listEl.appendChild(li);
  return li;
}

/** 진행률 채우기 — 바(--p)와 퍼센트 글자 */
function setUploadProgress(row, loaded, total) {
  const p = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const fill = row.querySelector('.sq-upload-row__bar i');
  if (fill) fill.style.setProperty('--p', p + '%');
  const state = row.querySelector('em');
  if (state) state.textContent = p + '%';
}

/** 업로드 실패 이유를 짧은 말로 */
function uploadErrorMessage(err) {
  if (!err) return 'Upload failed';
  if (err.code === 'STORAGE_QUOTA_EXCEEDED') return 'No space left';
  if (err.code === 'FILE_TOO_LARGE') return 'Too large';
  if (err.code === 'UNSUPPORTED_FILE_TYPE' || err.code === 'UNSUPPORTED_MEDIA_TYPE') return 'Unsupported format';
  if (err.code === 'NETWORK_ERROR') return 'Network error';
  return err.message ? err.message : 'Upload failed';
}

/** 업로드 성공 샘플을 목록 맨 위에 끼워 넣기 */
function prependSampleRow(sample) {
  const listEl = document.getElementById('file-list');
  if (!listEl) return;
  if (!sample.tags) sample.tags = [];
  sampleState.items.unshift(sample);
  listEl.insertBefore(sampleRow(sample), listEl.firstChild);
}

/**
 * 208. 저장 용량 표시 (FR-227) — "620 MB / 1 GB" 글자와 --p 막대를 바꿉니다
 * @param {number} usedBytes  쓴 양
 * @param {number} limitBytes 최대 (화면에 있던 값에서 읽음, 기본 1 GB)
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
function updateStorageBar(usedBytes, limitBytes) {
  const storage = document.getElementById('storage');
  if (!storage) return;
  const label = document.querySelector('#storage .sq-storage__val');
  const bar = document.querySelector('#storage .sq-storage__bar i');
  const limit = limitBytes ? limitBytes : sampleState.limitBytes;
  const pct = limit ? Math.min(100, (usedBytes / limit) * 100) : 0;
  if (label) label.textContent = formatBytes(usedBytes) + ' / ' + formatBytes(limit);
  if (bar) bar.style.setProperty('--p', pct.toFixed(1) + '%');
}

/** 바이트 → 12 MB · 1 GB 처럼 읽기 좋게 */
function formatBytes(bytes) {
  if (bytes == null) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return (mb / 1024).toFixed(1).replace(/\.0$/, '') + ' GB';
  if (mb >= 1) return Math.round(mb) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

/** 한 글자 수(620 MB · 1 GB) → 바이트 */
function parseBytes(text) {
  const m = /([\d.]+)\s*(GB|MB|KB|B)/i.exec(text ? text : '');
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === 'GB') return n * 1024 * 1024 * 1024;
  if (unit === 'MB') return n * 1024 * 1024;
  if (unit === 'KB') return n * 1024;
  return n;
}

/** 화면에 적힌 저장 한도(… / 1 GB)를 읽어 둠 — 남은 용량 API(FR-134)가 없어 표기값을 씁니다 */
function readStorageLimit() {
  const label = document.querySelector('#storage .sq-storage__val');
  if (!label) return;
  const parts = label.textContent.split('/');
  if (parts.length === 2) {
    const limit = parseBytes(parts[1]);
    if (limit) sampleState.limitBytes = limit;
  }
}

/**
 * 210. 이름 · 태그 인라인 편집 (FR-225) — 줄을 더블 클릭하면 아래에 편집 상자를 엽니다
 * - 이름은 글자칸, 태그는 /tags 목록의 누름 버튼으로 고릅니다
 * - Save → 바뀐 것만 renameSample(197)·setSampleTags(198)로 보내고 줄을 다시 그립니다
 * (구현: AI — 2026-10-17, S1-07, 함수 하나씩 검토)
 */
function startSampleEdit(row) {
  const id = row.dataset.sampleId;
  const listEl = document.getElementById('file-list');
  if (!id || !listEl) return;
  const existing = listEl.querySelector('.sq-file-edit');
  if (existing) existing.remove();
  const item = findSampleItem(id);
  if (!item) return;

  const box = document.createElement('li');
  box.className = 'sq-file-edit';
  box.dataset.sampleId = id;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'sq-file-edit__name';
  nameInput.maxLength = 200;
  nameInput.value = item.name;
  nameInput.setAttribute('aria-label', 'Sample name');
  box.appendChild(nameInput);

  const tagWrap = document.createElement('div');
  tagWrap.className = 'sq-file-edit__tags';
  const itemTagIds = (item.tags ? item.tags : []).map((t) => String(t.tag_id));
  sampleState.tags.forEach((t) => {
    const tagId = String(t.tag_id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sq-file-edit__tag';
    box.dataset.sampleId = id;
    btn.dataset.tagId = tagId;
    btn.setAttribute('aria-pressed', itemTagIds.indexOf(String(t.tag_id)) !== -1 ? 'true' : 'false');
    btn.textContent = t.name;
    btn.addEventListener('click', () => btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
    tagWrap.appendChild(btn);
  });
  if (!sampleState.tags.length) {
    const none = document.createElement('span');
    none.className = 'sq-file-edit__none';
    none.textContent = 'No tags available';
    tagWrap.appendChild(none);
  }
  box.appendChild(tagWrap);

  const actions = document.createElement('div');
  actions.className = 'sq-file-edit__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'sq-link';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => box.remove());
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'sq-upload sq-file-edit__save';
  save.textContent = 'Save';
  save.addEventListener('click', () => saveSampleEdit(row, box, item));
  actions.appendChild(cancel);
  actions.appendChild(save);
  box.appendChild(actions);

  row.after(box);
  nameInput.focus();
  nameInput.select();
}

/** 편집 상자의 값을 서버로 보내고 줄을 다시 그림 */
async function saveSampleEdit(row, box, item) {
  const save = box.querySelector('.sq-file-edit__save');
  const nameEl = box.querySelector('.sq-file-edit__name');
  const name = (nameEl && nameEl.value ? nameEl.value : '').trim();
  const tagIds = Array.prototype.map.call(box.querySelectorAll('.sq-file-edit__tag[aria-pressed="true"]'), (b) => Number(b.dataset.tagId));
  const currentIds = (item.tags ? item.tags : []).map((t) => String(t.tag_id)).sort().join(',');
  const nextIds = tagIds.map((n) => String(n)).sort().join(',');
  if (save) save.disabled = true;
  try {
    let updated = item;
    if (name && name !== item.name) updated = await renameSample(item.sample_id, name);
    if (currentIds !== nextIds) updated = await setSampleTags(item.sample_id, tagIds);
    replaceSampleRow(row, updated ? updated : item);
    box.remove();
    showToast('Sample updated');
  } catch (err) {
    showToast(err && err.message ? err.message : 'Could not update the sample');
    if (save) save.disabled = false;
  }
}

/** 목록의 한 줄을 새 값으로 갈아 끼우기 */
function replaceSampleRow(row, item) {
  const idx = sampleState.items.findIndex((s) => String(s.sample_id) === String(item.sample_id));
  if (idx !== -1) sampleState.items[idx] = item;
  const fresh = sampleRow(item);
  fresh.setAttribute('aria-selected', row.getAttribute('aria-selected') ? row.getAttribute('aria-selected') : 'false');
  row.replaceWith(fresh);
  applySampleFilters();
}

/** 샘플 번호로 목록 값 찾기 */
function findSampleItem(id) {
  return sampleState.items.find((s) => String(s.sample_id) === String(id)) || null;
}

/** 줄의 × 로 샘플 지우기 (FR-225) — 확인 후 deleteSample(199) */
function removeSample(row) {
  const id = row.dataset.sampleId;
  const item = findSampleItem(id);
  if (!id || !item) return;
  if (!window.confirm('Delete "' + item.name + '"?')) return;
  deleteSample(id).then(() => {
    if (sampleState.playingId === id) stopSamplePreview();
    const idx = sampleState.items.findIndex((s) => String(s.sample_id) === String(id));
    if (idx !== -1) sampleState.items.splice(idx, 1);
    sampleState.total = Math.max(0, sampleState.total - 1);
    sampleState.usedBytes = Math.max(0, sampleState.usedBytes - (item.file_size ? item.file_size : 0));
    updateStorageBar(sampleState.usedBytes, sampleState.limitBytes);
    row.remove();
    applySampleFilters();
    showToast(item.name + ' deleted');
  }).catch((err) => {
    showToast(err && err.message ? err.message : 'Could not delete the sample');
  });
}

/** ＋ Tag 버튼으로 태그 필터 돌리기 — 없음 → 태그1 → 태그2 … → 없음 */
function cycleTagFilter(btn) {
  const order = [null].concat(sampleState.tags.map((t) => t.name));
  const idx = order.indexOf(sampleState.filterTag);
  const next = order[(idx + 1) % order.length];
  sampleState.filterTag = next;
  btn.setAttribute('aria-pressed', next ? 'true' : 'false');
  btn.textContent = next ? '#' + next : '＋ Tag';
  applySampleFilters();
}

/** 태그 필터 지우기 */
function clearTagFilter() {
  sampleState.filterTag = null;
  const btn = document.querySelector('.sq-filters__tag');
  if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.textContent = '＋ Tag'; }
}

/** 라이브러리 패널의 모든 버튼 연결 (201 에서 한 번) */
function bindSamplePanelEvents() {
  const listEl = document.getElementById('file-list');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const del = e.target.closest('.sq-file__del');
      if (del) { removeSample(del.closest('.sq-file')); return; }
      const play = e.target.closest('.sq-file__play');
      if (play) { toggleSamplePreview(play.closest('.sq-file')); return; }
    });
    listEl.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.sq-file');
      if (!row) return;
      if (e.target.closest('.sq-file__title') || e.target.closest('.sq-file__tags')) startSampleEdit(row);
    });
  }

  const searchEl = document.getElementById('file-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      window.clearTimeout(sampleFilterTimer);
      sampleFilterTimer = window.setTimeout(() => applySampleFilters(), 150);
    });
  }

  const filters = document.querySelector('.sq-filters');
  if (filters) {
    filters.addEventListener('click', (e) => {
      const tagBtn = e.target.closest('.sq-filters__tag');
      if (tagBtn) { cycleTagFilter(tagBtn); return; }
      const b = e.target.closest('button');
      if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', String(on));
      applySampleFilters();
    });
  }

  const input = document.getElementById('upload-input');
  const uploadBtn = document.getElementById('upload-button');
  const emptyBtn = document.getElementById('empty-upload');
  if (uploadBtn && input) uploadBtn.addEventListener('click', () => input.click());
  if (emptyBtn && input) emptyBtn.addEventListener('click', () => input.click());
  if (input) {
    input.addEventListener('change', () => {
      if (input.files && input.files.length) uploadQueue(input.files);
      input.value = '';
    });
  }

  const drop = document.getElementById('drop-zone');
  if (drop) {
    drop.addEventListener('dragover', (e) => {
      if ([...e.dataTransfer.types].indexOf('Files') !== -1) { e.preventDefault(); drop.classList.add('is-over'); }
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
      if (e.dataTransfer.files.length) uploadQueue(e.dataTransfer.files);
    });
  }

  const clearBtn = document.getElementById('clear-search');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchEl) searchEl.value = '';
      clearTagFilter();
      applySampleFilters();
    });
  }
}



function rebuildFlows(chain) {
  // 카드 사이에만 → (＋ 는 마지막 뒤)
  chain.querySelectorAll('.sq-flow').forEach((f) => f.remove());
  const cards = [...chain.querySelectorAll(':scope > .sq-fx')];
  cards.slice(0, -1).forEach((c) => {
    const f = document.createElement('li');
    f.className = 'sq-flow';
    f.setAttribute('aria-hidden', 'true');
    f.textContent = '→';
    c.after(f);
  });
}

function initAccordionButtons() {
  const lanes = document.getElementById('lanes');
  let fxSeq = 0;
  lanes.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !b.closest('.sq-acc')) return;
    // 실제 트랙(.is-live)의 칸은 sequencer-devices.js 가 맡는다 — 여기 예시 배선은 건너뛴다 (2026-10-18)
    if (b.closest('.sq-acc').classList.contains('is-live')) return;
    if (b.matches('.sq-fx__power')) {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      b.closest('.sq-fx').classList.toggle('is-bypassed', !on);
    } else if (b.matches('.sq-fx-add')) {
      // ＋ = 마지막 이펙트 뒤에 새 이펙트
      const chain = b.closest('.sq-chain');
      const li = document.createElement('li');
      li.className = 'sq-fx';
      li.draggable = true;
      li.innerHTML = `<div class="sq-fx__head"><span class="sq-fx__grip" aria-hidden="true">⠿</span>Effect ${++fxSeq}<button type="button" class="sq-fx__power" aria-pressed="true" aria-label="Bypass">⏻</button></div>
                  <div class="sq-knobs"><span class="sq-knob"><i style="--a:90deg"></i>Mix</span></div>
                  <button type="button" class="sq-fx__split" aria-label="Split into parallel branches">＋</button>`;
      b.closest('li').before(li);
      rebuildFlows(chain);
      showToast('Choosing the effect comes with the plugin browser — added a blank slot');
    } else if (b.matches('.sq-fx__split')) {
      showToast('Parallel branches come with the audio engine');
    } else if (b.matches('.sq-irow__power, .sq-irow__solo')) {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      b.closest('.sq-irow').classList.toggle('is-bypassed', b.matches('.sq-irow__power') && b.getAttribute('aria-pressed') === 'false');
    } else if (b.matches('.sq-iadd')) {
      const li = document.createElement('li');
      li.className = 'sq-irow';
      li.innerHTML = '<button type="button" class="sq-irow__power" aria-pressed="true" aria-label="Layer on/off">⏻</button><span class="sq-irow__name"><b>New instrument</b><small>Pick from Plugins</small></span><span class="sq-irow__vol sq-num">0.0 dB<i style="--v:70%"></i></span><span class="sq-irow__pan" style="--p:0deg" aria-label="Pan"></span><button type="button" class="sq-irow__solo" aria-pressed="false" aria-label="Solo layer">S</button>';
      b.closest('li').before(li);
    }
  });
  // ⠿ 끌어 이펙트 순서 바꾸기 — 끼울 자리에 보라 선
  let dragFx = null;
  const line = document.createElement('li');
  line.className = 'sq-fx-insert';
  lanes.addEventListener('dragstart', (e) => {
    const fx = e.target.closest?.('.sq-fx');
    if (!fx) return;
    if (fx.closest('.sq-acc.is-live')) return;   // 실제 트랙의 카드 끌기는 sequencer-devices.js 가 맡는다
    dragFx = fx;
    fx.classList.add('is-dragging');
    e.dataTransfer.setData('text/plain', 'fx');
    e.dataTransfer.effectAllowed = 'move';
  });
  lanes.addEventListener('dragover', (e) => {
    if (!dragFx) return;
    const chain = e.target.closest('.sq-chain');
    if (!chain || chain !== dragFx.parentElement) return;
    e.preventDefault();
    const cards = [...chain.querySelectorAll(':scope > .sq-fx')].filter((c) => c !== dragFx);
    const before = cards.find((c) => e.clientX < c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2);
    (before ?? chain.querySelector('.sq-fx-add').closest('li')).before(line);
  });
  lanes.addEventListener('drop', (e) => {
    if (!dragFx || !line.parentElement) return;
    e.preventDefault();
    line.replaceWith(dragFx);
    rebuildFlows(dragFx.parentElement);
    onChange({ type: 'fxOrder', chain: dragFx.parentElement });
  });
  lanes.addEventListener('dragend', () => { dragFx?.classList.remove('is-dragging'); line.remove(); dragFx = null; });

  // Connect to Another — Connected 면 번호 · 플러그인을 쓰고, 믹서는 OFF 덮개
  lanes.addEventListener('change', (e) => {
    const route = e.target.closest('.sq-route');
    if (!route) return;
    const acc = route.closest('.sq-acc');
    if (acc && acc.classList.contains('is-live')) return;   // 실제 트랙의 칸은 sequencer-devices.js 가 맡는다
    const [type, num, plugin] = route.querySelectorAll('select, input');
    const on = type.value === 'connected' && num.value;   // 값은 언어와 상관없이 고정 (value 속성)
    plugin.disabled = type.value !== 'connected';
    route.classList.toggle('is-live', !!on);
    const mixer = acc.querySelector('[aria-label="Mixer"]');
    let off = mixer?.querySelector('.sq-off');
    if (on && !off && mixer) {
      off = document.createElement('div');
      off.className = 'sq-off';
      mixer.append(off);
    }
    if (off) {
      if (on) off.innerHTML = `<b>OFF</b>Connected to<br>Track ${num.value} ›<br>${plugin.value === '—' ? 'Input' : plugin.value}`;
      else off.remove();
    }
    onChange({ type: 'connection', on: !!on, track: num.value, plugin: plugin.value });
  });
}

/* ───────── Nyxi Agent · 샘플 설정 ───────── */

function initAgentAndSample() {
  const agent = document.getElementById('panel-agent');
  agent?.addEventListener('click', (e) => {
    const b = e.target.closest('.sq-card__act button');
    if (!b) return;
    const card = b.closest('.sq-card');
    const t = b.textContent.trim();
    if (t === 'Dismiss') card.remove();
    else if (t === 'Apply') { card.classList.add('is-applied'); b.textContent = 'Applied ✓'; b.disabled = true; showToast('Shown as applied — real settings change with the audio engine'); }
    else if (t === 'Preview') showToast('Preview plays with the audio engine');
  });
  const form = document.getElementById('agent-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    const log = document.getElementById('agent-log');
    const me = document.createElement('li');
    me.className = 'sq-bubble is-user';
    me.textContent = text;
    log.append(me);
    const ny = document.createElement('li');
    ny.className = 'sq-bubble is-nyxi';
    ny.textContent = 'Nyxi AI is not connected yet — I will answer once the AI server is ready ✦';
    log.append(ny);
    log.scrollTop = log.scrollHeight;
    input.value = '';
    onChange({ type: 'agentAsk', text });
  });
  form?.querySelector('input')?.addEventListener('keydown', (e) => e.stopPropagation());
  // 샘플 설정 토글 · AI 분리
  const sample = document.getElementById('panel-sample');
  sample?.addEventListener('click', (e) => {
    const b = e.target.closest('.sq-toggles button');
    if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    if (e.target.closest('.sq-ai-btn')) showToast('AI stem separation comes with Phase 4');
  });
  sample?.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
}

/* ───────── 스펙트럼 (재생 중 움직이는 모양 — 실제 분석은 엔진 연결 후) ───────── */

function initSpectrum() {
  const bars = [...document.querySelectorAll('#spectrum i')];
  const base = bars.map((b) => parseFloat(b.style.getPropertyValue('--h')) || 30);
  let t = 0;
  const tick = () => {
    if (document.body.classList.contains('is-playing')) {
      t += 1;
      bars.forEach((b, i) => {
        const wobble = Math.sin(t / 6 + i * 0.9) * 12 + Math.sin(t / 2.3 + i * 2.1) * 6;
        b.style.setProperty('--h', `${Math.max(4, Math.min(100, base[i] + wobble))}%`);
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
