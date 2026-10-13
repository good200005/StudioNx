// 시퀀서 화면 버튼 (구현: AI — 사용자 요청 2026-10-06 "나머지 버튼들도 구현")
// 설명: docs/ai-notes/31_sequencer_buttons.md
// 상단(메뉴 · 언어 · PAT/SONG · BPM · 시간 · 💬 · Nyxi · Pattern/Key · 창 바로가기) · 왼쪽(카테고리 · 필터 · 검색 · 업로드 · 협업)
// · 아래 칸(열기/닫기 · 믹서 탭 · 샘플 설정 · Nyxi Agent) · 트랙 펼침(이펙트 · 악기 레이어 · Connect to Another) · 스페이스 · Tab
// 소리 엔진 · 서버가 필요한 것은 화면 상태만 바꾸고 showToast 로 알림

import {
  showToast, startPlayback, pausePlayback, isPlaying, getPlayheadBar, setPlayheadBar, setDrawTemplate, addTrack,
} from './sequencer-arrange.js';
import { openRoll } from './sequencer-roll.js';

let onChange = () => {};

/** @param {{ onChange?: (change: object) => void }} [options] */
export function initUI(options = {}) {
  onChange = options.onChange ?? onChange;
  initMenus();
  initLanguage();
  initTransportExtras();
  initHeaderChips();
  initRail();
  initBottomPanels();
  initAccordionButtons();
  initAgentAndSample();
  initSpectrum();
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
  'track.addMidi', 'track.addAudio', 'track.addReturn', 'marker.add', 'window.close', 'help.shortcuts', 'project.save',
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
  'window.close': () => window.close(),
  'help.shortcuts': () => showToast('P B D T S C E tools · A automation · Z fit · Space play · Tab mixer · Delete remove · Ctrl+wheel zoom', 6000),
  'project.save': () => showToast('Saving needs the server — not connected yet'),
};

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

function applyFilters() {
  const list = visibleList();
  if (!list) return;
  const q = document.getElementById('file-search')?.value.trim().toLowerCase() ?? '';
  const chip = list.id === 'file-list' ? document.querySelector('.sq-filters [aria-pressed="true"]') : null;
  const re = chip ? FILTERS[chip.textContent.trim()] : null;
  let shown = 0;
  list.querySelectorAll('.sq-file').forEach((li) => {
    const name = li.querySelector('.sq-file__name')?.textContent ?? '';
    const ok = (!q || name.toLowerCase().includes(q)) && (!re || re.test(name));
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
  // 필터 칩 — 하나만, 다시 누르면 전체
  document.querySelector('.sq-filters')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    applyFilters();
  });
  document.getElementById('file-search')?.addEventListener('input', applyFilters);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('file-search')?.focus(); }
  });
  // 업로드 · 드롭 존 — 고르기까지만 (업로드는 서버 연결 후)
  const input = document.getElementById('upload-input');
  document.getElementById('upload-button')?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', () => { if (input.files.length) showToast(`${input.files.length} file(s) selected — uploading needs the server`); input.value = ''; });
  const drop = document.getElementById('drop-zone');
  drop?.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); drop.classList.add('is-over'); } });
  drop?.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop?.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    const n = e.dataTransfer.files.length;
    if (n) showToast(`${n} file(s) dropped — uploading needs the server`);
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

/* ───────── 트랙 펼침 버튼 ───────── */

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
