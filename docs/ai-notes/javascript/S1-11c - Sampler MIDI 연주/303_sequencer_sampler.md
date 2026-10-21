# JavaScript 303 — 샘플 고르기 (`pages/sequencer-sampler.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-sampler.js` |
| 작업 | S1-11c Sampler MIDI 연주: 상세 창의 Sample 줄, 샘플 고르기 창, 카드 부제 (FR-241) |
| 작성 | Claude (AI), 2026-10-21, 사용자 검토 |
| 이전, 다음 | 이전 302 Sampler 연결, 다음 304 장치 화면 연결 |

## 1. 하는 일

Sampler 악기에 어떤 샘플을 붙일지 고르는 화면 부품을 모았습니다. 목업(`docs/page_mockups/sampler/`)에서 정한 모양을 그대로 만듭니다.

| 부품 | 내용 |
|---|---|
| Sample 줄 | 고른 샘플의 이름, 길이, 샘플레이트, 채널을 한 줄로 보여 주고 Change… 버튼을 둡니다. 샘플이 없으면 "No sample chosen"과 Choose… 버튼, 경고 문구가 나옵니다. |
| 파형과 Root 표시 | 샘플의 파형을 그리고 왼쪽 위에 Root 노트 이름(예: Root C4)을 붙입니다. |
| 고르기 창 | Change…를 누르면 줄 아래에 열립니다. 라이브러리의 샘플을 이름으로 검색하고, 줄마다 미리 듣기(▶) 버튼이 있습니다. |
| 끌어 놓기 | 왼쪽 브라우저의 샘플 줄을 Sample 줄 위로 끌어 놓으면 그 샘플로 바뀝니다. |
| 카드 부제 | 카드 이름 아래에 "샘플 이름, 모드"를 보여 주고, 샘플이 없으면 경고를 보여 줍니다. |

화면 부품과 DOM이 없는 계산을 한 파일에 두었고, 계산은 Node에서도 시험합니다.

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| `sequencer-devices.js`의 `cardHtml` (304) | `cardSubtitle`과 `sampleInfoOf`로 카드 부제를 만듭니다. |
| `sequencer-devices.js`의 `paramCellHtml`, `bindModalParam` (304) | `type: "sample"` 칸을 `samplePickHtml`로 그리고 `bindSamplePick`으로 동작을 연결합니다. |
| `sequencer-devices.js`의 `renderModalParams` (304) | `ignoredKeys`로 One-Shot에서 무시되는 칸을 흐리게 합니다. |
| `sequencer-devices.js`의 `initDevices` (304) | `loadSampleLibrary`로 샘플 목록을 미리 읽어 둡니다. |

## 3. 코드

### 3.1 순수 함수

```javascript
export function noteName(n) {
  const v = Math.round(Number(n) || 0);
  return NOTE_NAMES[((v % 12) + 12) % 12] + (Math.floor(v / 12) - 1);
}
```

```javascript
export function ignoredKeys(mode) {
  return mode === 'oneshot' ? ['loop', 'sustain', 'release'] : [];
}
```

```javascript
export function cardSubtitle(info, sampleId, modeLabel) {
  if (sampleId == null || sampleId === '') return { empty: true, text: 'No sample chosen. Notes make no sound.' };
  const name = info ? info.name : 'Sample #' + sampleId;
  return { empty: false, text: name + ' · ' + modeLabel };
}
```

```javascript
export function sampleInfoText(info) {
  if (!info) return '';
  const parts = [];
  if (info.duration_ms) {
    const sec = Math.round(info.duration_ms / 1000);
    parts.push(Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60));
  }
  if (info.sample_rate) parts.push((info.sample_rate / 1000) + ' kHz');
  if (info.channels) parts.push(info.channels === 1 ? 'mono' : (info.channels === 2 ? 'stereo' : info.channels + ' ch'));
  return parts.join(' · ');
}
```

### 3.2 샘플 목록

```javascript
export function loadSampleLibrary(force) {
  if (loading && !force) return loading;
  loading = (async function () {
    const all = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const res = await fetchSampleList({ page: page, size: PAGE_SIZE });
      const items = res && res.items ? res.items : [];
      items.forEach(function (it) { all.push(it); });
      if (all.length >= (res ? res.total : 0) || !items.length) break;
    }
    library = all;
    return library;
  }()).catch(function (err) {
    loading = null;
    if (window.console) console.warn('[sampler] 샘플 목록을 읽지 못했습니다', err);
    return library;
  });
  return loading;
}
```

```javascript
export function sampleInfoOf(sampleId) {
  if (sampleId == null || sampleId === '') return null;
  const found = library.filter(function (s) { return String(s.sample_id) === String(sampleId); })[0];
  return found || null;
}
```

### 3.3 Sample 줄

```javascript
export function samplePickHtml(item, value, rootNote) {
  const has = value != null && value !== '';
  const info = has ? sampleInfoOf(value) : null;
  const name = has ? (info ? info.name : 'Sample #' + value) : 'No sample chosen';
  const meta = has ? sampleInfoText(info) : '';
  return '<div class="sq-param sq-param--wide sq-samp' + (has ? '' : ' is-empty') + '" data-param-cell="' + esc(item.key) + '">'
    + '<span class="sq-samp__label">' + esc(item.name) + '</span>'
    + '<div class="sq-samp__row">'
    + '<span class="sq-samp__icon" aria-hidden="true">♫</span>'
    + '<span class="sq-samp__name">' + esc(name) + '</span>'
    + '<span class="sq-samp__meta sq-num">' + esc(meta) + '</span>'
    + '<button type="button" class="sq-dialog__btn" data-samp="change">' + (has ? 'Change…' : 'Choose…') + '</button></div>'
    + (has
      ? '<div class="sq-samp__wave" data-samp="wave"><canvas width="560" height="56" aria-label="Waveform of ' + esc(name) + '"></canvas>'
        + '<span class="sq-samp__root">Root ' + esc(noteName(rootNote)) + '</span></div>'
      : '<p class="sq-samp__warn">⚠ No sample chosen. Notes make no sound.</p>')
    + '<div class="sq-samp__pick" data-samp="pick" hidden>'
    + '<strong>Choose a sample from your library</strong>'
    + '<input type="search" data-samp="search" placeholder="Search samples…" aria-label="Search samples">'
    + '<ul data-samp="list"></ul>'
    + '<small>You can also drag a sample from the browser onto the waveform.</small></div>'
    + '</div>';
}
```

```javascript
function renderPickList(cell, query, selectedId) {
  const list = cell.querySelector('[data-samp="list"]');
  if (!list) return;
  const q = String(query || '').trim().toLowerCase();
  const found = library.filter(function (s) { return !q || String(s.name).toLowerCase().indexOf(q) >= 0; });
  if (!found.length) {
    list.innerHTML = '<li class="sq-samp__none">' + (library.length ? 'No sample matches.' : 'Your library is empty. Upload a sample in the browser first.') + '</li>';
    return;
  }
  list.innerHTML = found.map(function (s) {
    const tag = s.tags && s.tags.length ? ' · ' + esc(s.tags[0].name) : '';
    return '<li><button type="button" class="sq-samp__item' + (String(s.sample_id) === String(selectedId) ? ' is-on' : '') + '" data-sample-id="' + s.sample_id + '">'
      + '<span aria-hidden="true">♫</span><span class="sq-samp__iname">' + esc(s.name) + '</span>'
      + '<span class="sq-samp__imeta sq-num">' + esc(sampleInfoText(s).split(' · ')[0] || '') + tag + '</span></button>'
      + '<button type="button" class="sq-samp__prev" data-preview="' + s.sample_id + '" aria-label="Preview ' + esc(s.name) + '">▶</button></li>';
  }).join('');
}
```

```javascript
async function paintWave(cell, sampleId) {
  const canvas = cell.querySelector('canvas');
  if (!canvas || !canvas.getContext) return;
  let peaks = peaksCache[sampleId];
  if (!peaks) {
    try {
      const res = await fetchSampleWaveform(sampleId);
      peaks = res && res.peaks ? res.peaks : [];
      peaksCache[sampleId] = peaks;
    } catch (err) {
      return;   // 파형이 없어도 샘플은 울립니다
    }
  }
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = window.getComputedStyle(canvas).color;
  if (!peaks.length) return;
  for (let x = 0; x < w; x += 1) {
    const p = peaks[Math.min(peaks.length - 1, Math.floor(x * peaks.length / w))];
    const lo = Math.max(-1, Math.min(1, Number(p[0]) || 0));
    const hi = Math.max(-1, Math.min(1, Number(p[1]) || 0));
    const y1 = (1 - hi) / 2 * h;
    const y2 = (1 - lo) / 2 * h;
    g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}
```

```javascript
async function previewSample(sampleId) {
  if (previewAudio) {
    const same = previewAudio.dataset.sampleId === String(sampleId);
    previewAudio.pause();
    previewAudio = null;
    if (same) return;
  }
  const url = await fetchSampleFileUrl(sampleId);
  previewAudio = new Audio(url);
  previewAudio.dataset.sampleId = String(sampleId);
  previewAudio.addEventListener('ended', function () { previewAudio = null; });
  await previewAudio.play();
}
```

```javascript
export function bindSamplePick(cell, value, onPick) {
  const pick = cell.querySelector('[data-samp="pick"]');
  const search = cell.querySelector('[data-samp="search"]');
  const change = cell.querySelector('[data-samp="change"]');
  if (value != null && value !== '') paintWave(cell, value);

  change.addEventListener('click', function () {
    const open = pick.hidden;
    pick.hidden = !open;
    if (!open) return;
    renderPickList(cell, '', value);
    loadSampleLibrary(true).then(function () { renderPickList(cell, search.value, value); });
    search.value = '';
    search.focus();
  });
  search.addEventListener('input', function () { renderPickList(cell, search.value, value); });
  pick.addEventListener('click', function (e) {
    const prev = e.target.closest('[data-preview]');
    if (prev) {
      previewSample(prev.getAttribute('data-preview')).catch(function () { /* 재생이 막혀도 고르기는 계속 */ });
      return;
    }
    const item = e.target.closest('[data-sample-id]');
    if (item) {
      stopSamplePreview();
      onPick(Number(item.getAttribute('data-sample-id')));
    }
  });

  // 브라우저의 샘플 줄을 칸 위에 놓으면 그 샘플로 바꿈
  cell.addEventListener('dragover', function (e) {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, DND_TYPE) >= 0) {
      e.preventDefault();
      cell.classList.add('is-drop');
    }
  });
  cell.addEventListener('dragleave', function () { cell.classList.remove('is-drop'); });
  cell.addEventListener('drop', function (e) {
    cell.classList.remove('is-drop');
    if (!e.dataTransfer) return;
    let data = null;
    try { data = JSON.parse(e.dataTransfer.getData(DND_TYPE)); } catch (err) { data = null; }
    if (!data || data.kind !== 'audio' || !data.sampleId) return;
    e.preventDefault();
    onPick(Number(data.sampleId));
  });
}
```

## 4. 동작 순서

```text
상세 창을 열면 Sample 칸을 samplePickHtml 이 그리고, bindSamplePick 이 동작을 붙입니다
  샘플이 있으면 ─▶ paintWave: GET /samples/{id}/waveform 의 peaks 를 캔버스에 세로선으로 그림
  Change… 클릭 ─▶ 고르기 창이 열리고 loadSampleLibrary(true) 로 목록을 새로 읽어 그림
  검색어 입력  ─▶ renderPickList 가 이름에 검색어가 든 샘플만 다시 그림
  ▶ 클릭      ─▶ previewSample: 파일 주소를 받아 재생, 같은 샘플을 다시 누르면 멈춤
  샘플 클릭    ─▶ onPick(번호): 호출한 쪽이 초안(draft)을 바꾸고 칸을 다시 그림 (Save 를 눌러야 서버에 저장)
  브라우저 줄을 칸 위에 놓으면 ─▶ 같은 onPick
```

노트 이름은 MIDI 번호 60을 C4로 읽습니다. `noteName(60)`은 `'C4'`, `noteName(61)`은 `'C#4'`, `noteName(48)`은 `'C3'`입니다.

## 5. 최신 문법으로 쓰면

```javascript
// noteName 을 최신 문법으로 쓴 모양
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (n) => {
  const v = Math.round(Number(n) || 0);
  return `${NOTE_NAMES[((v % 12) + 12) % 12]}${Math.floor(v / 12) - 1}`;
};

// 샘플 정보 찾기와 검색
export const sampleInfoOf = (id) => (id == null || id === '' ? null : library.find((s) => String(s.sample_id) === String(id)) ?? null);
const found = library.filter((s) => !q || s.name.toLowerCase().includes(q));
```

| 전통 문법 (실제 코드) | 최신 문법 |
|---|---|
| `'C' + 4`처럼 `+`로 문자열 잇기 | 템플릿 리터럴 `` `${a}${b}` `` |
| `filter(...)[0]`로 첫 항목 찾기 | `find` |
| `indexOf(q) >= 0` | `includes(q)` |
| `found \|\| null` | `found ?? null` |
| `res && res.items ? res.items : []` | `res?.items ?? []` |

## 6. 왜 이렇게

| 선택 | 이유 |
|---|---|
| 새 파일로 분리했습니다 | `sequencer-devices.js`가 이미 약 2300줄입니다. 샘플 고르기는 서로 연결된 부품(줄, 고르기 창, 파형, 미리 듣기, 끌어 놓기)이라 하나로 묶으면 읽기 쉽습니다. |
| 샘플 목록을 한 번 읽어 담아 둡니다 | 카드마다 이름을 보여 주려고 요청을 보내면 낭비입니다. 목록은 한 쪽 50개씩 최대 10쪽까지 읽고, 고르기 창을 열 때만 다시 읽어서 방금 올린 샘플도 보이게 합니다. |
| 목록을 못 읽어도 카드는 "Sample #번호"로 보입니다 | 이름이 안 보일 뿐 소리와 저장에는 문제가 없으므로, 오류를 띄우지 않고 콘솔에만 경고합니다. |
| 파형은 서버의 `peaks`를 씁니다 | 브라우저에서 샘플 전체를 다시 디코딩하지 않아도 됩니다. 브라우저의 샘플 줄(S1-07)도 같은 API를 씁니다. 파형을 못 받아도 샘플은 울립니다. |
| 파형 요청은 샘플마다 한 번만 합니다 | 모드를 바꾸거나 노브를 만져서 칸을 다시 그릴 때마다 요청하지 않도록 `peaksCache`에 담습니다. |
| 샘플을 고르는 것은 초안만 바꿉니다 | 다른 파라미터와 똑같이 Save를 눌러야 저장되고, Reset과 A/B 비교도 그대로 동작합니다. |
| 끌어 놓기는 브라우저의 기존 형식을 씁니다 | 왼쪽 목록이 이미 `application/x-studionx-clip`으로 샘플 번호를 싣고 있습니다. 오디오가 아닌 항목(MIDI 패턴)은 무시합니다. |
| 미리 듣기는 하나만 재생합니다 | 여러 개를 연달아 누르면 소리가 겹치므로, 새로 누르면 이전 것을 멈춥니다. 상세 창을 닫을 때도 멈춥니다(`stopSamplePreview`). |

## 7. 시험

- `docs/handoff/s1-11c_tests/ui_sampler.mjs` (39건)가 헤드리스 Chrome으로 실제 화면을 확인합니다.
  - 카드: 샘플이 없으면 "No sample chosen. Notes make no sound." 경고와 점선 테두리가 나오고, 고른 뒤에는 "샘플 이름, One-Shot"으로 바뀝니다.
  - 상세 창: 탭이 Sample과 Amp Env이고, Sample 줄과 Mode 줄이 있으며, Root 노브가 C4로 보입니다.
  - 고르기 창: 시험 샘플 2개가 목록에 있고, 줄마다 미리 듣기 버튼이 있으며, 검색하면 거릅니다.
  - 고른 뒤: 이름과 정보 줄(0:02, 44.1 kHz, mono), 그려진 파형, Root C4 표시, 경고 사라짐을 확인합니다.
  - 끌어 놓기: 샘플이 없는 상태에서도 놓으면 붙고 안내 문구("Drag a sample here…")가 보이며, 샘플 줄을 놓으면 바뀌고, MIDI 패턴을 놓으면 무시되며, Reset이 기본값으로 되돌립니다.
- 시험 중 발견한 일: 첫 실행에서 샘플 이름 기대값이 `s1-11c-sine440.wav`였는데, 라이브러리는 확장자를 뗀 `s1-11c-sine440`으로 보여 줍니다. 화면이 맞고 시험의 기대값이 틀렸습니다. 또 이 화면은 트랙의 펼침 상태를 기억해 두었다가(`restoreOpenPanels`) 새로 열 때 복원하므로, 시험이 펼침 버튼을 무조건 누르면 오히려 접힙니다. 닫혀 있을 때만 누르도록 고쳤습니다.
