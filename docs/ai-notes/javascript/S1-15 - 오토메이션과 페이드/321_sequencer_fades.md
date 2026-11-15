# JavaScript 321 — 오디오 클립 페이드 편집 (`pages/sequencer-fades.js`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-fades.js` |
| 작업 | S1-15 오토메이션과 페이드: 오디오 클립 양끝의 페이드 길이와 곡선을 핸들로 편집하고 저장 |
| 작성 | Claude (AI), 2026-11-15, 사용자 검토 |
| 이전, 다음 | 이전 320 레인 화면, 다음 322 재생 연결 |

## 1. 하는 일

오디오 클립 위쪽에 핸들 네 개가 생깁니다. Ableton의 Fade In Start, Fade Out End, Fade Curve와 같은 방식입니다.

| 조작 | 결과 |
|---|---|
| 클립 양끝의 네모 핸들을 안쪽으로 끌기 | 페이드 길이가 바뀝니다 (0.01마디 단위). |
| 핸들 사이 곡선 위의 동그란 핸들을 위아래로 끌기 | 곡선 모양이 바뀝니다. |
| 핸들을 더블클릭 | 그 페이드를 지웁니다. |
| 클립을 선택하고 `Ctrl+Alt+F` | 양끝에 기본 페이드(0.125마디)를 만들거나, 이미 있으면 지웁니다. |

값은 `clip.dataset`에 둡니다 (`fadeIn`, `fadeOut`은 마디 단위, `fadeInCurve`, `fadeOutCurve`는 -1~1). 핸들을 놓으면 `PATCH /clips/{id}`로 저장하고, 서버에는 tick 단위(마디 × 3840)로 보냅니다.

```text
initFades({ lanes })
  pointerdown(캡처) → startDrag     클립 옮기기보다 먼저 받아서 막음
  dblclick           → removeFade
  Ctrl+Alt+F 또는 명령 'clip.fades' → toggleFades
  MutationObserver                  새 클립에 페이드 그림을 붙이고, 길이가 바뀌면 clampToLength
  syncFades()                       불러온 모든 오디오 클립에 그림
```

## 2. 언제 쓰나

| 쓰는 곳 | 하는 일 |
|---|---|
| 시퀀서 시작 (`sequencer.js`) | `initFades({ lanes })`로 켭니다. |
| 프로젝트를 불러온 뒤 | `syncFades`가 서버 기록의 페이드를 화면에 그립니다. |
| 재생 | 저장된 `fade_*` 값을 319의 `fadePoints`가 소리에 반영합니다 (322). |

## 3. 코드

### 3.1 곡선과 값 읽기

```javascript
const K = 6;

function shape(x, curve) {
  const a = -(Number(curve) || 0) * K;
  if (Math.abs(a) < 1e-6) return x;
  return (Math.exp(a * x) - 1) / (Math.exp(a) - 1);
}

function curveForMid(g) {
  const gg = Math.min(Math.max(g, 0.02), 0.98);
  return Math.min(Math.max(-2 * Math.log(1 / gg - 1) / K, -1), 1);
}
```

`shape`는 319의 `curveShape`와 같은 식입니다. `curveForMid`는 그 역함수입니다. 곡선 중간(x=0.5)의 배율이 g가 되게 하는 `curve`를 닫힌 식으로 구하므로, 사용자가 동그란 핸들을 놓은 높이가 그대로 곡선이 됩니다. g를 0.02~0.98로 막는 이유는 `ln(1/g - 1)`이 0과 1에서 무한대가 되기 때문입니다.

### 3.2 서버 값 가져오기 `adopt`

```javascript
function adopt(clip) {
  if (clip.dataset.fadeIn !== undefined) return;
  const rec = clip.dataset.clipId ? clipRecord(clip.dataset.clipId) : null;
  clip.dataset.fadeIn = String(rec ? (Number(rec.fade_in_tick) || 0) / TICKS_PER_BAR : 0);
  clip.dataset.fadeOut = String(rec ? (Number(rec.fade_out_tick) || 0) / TICKS_PER_BAR : 0);
  clip.dataset.fadeInCurve = String(rec ? Number(rec.fade_in_curve) || 0 : 0);
  clip.dataset.fadeOutCurve = String(rec ? Number(rec.fade_out_curve) || 0 : 0);
}
```

화면 값(`dataset`)이 이미 있으면 그대로 둡니다. 서버 기록(`clipRecord`)은 처음 한 번만 옮겨 오면 되고, 이후에는 화면 값이 최신입니다.

### 3.3 그리기 `renderFades`

```javascript
export function renderFades(clip) {
  if (!clip.classList.contains('sq-clip--audio')) return;
  adopt(clip);
  const len = lengthBars(clip);
  ['in', 'out'].forEach(function (side) {
    const key = side === 'in' ? 'fadeIn' : 'fadeOut';
    const curve = num(clip, key + 'Curve');
    const bars = Math.min(num(clip, key), len);
    const el = part(clip, side);
    el.classList.toggle('is-empty', !(bars > 0));
    if (!(bars > 0)) { el.style.width = '0'; return; }
    el.style.width = (len > 0 ? bars / len * 100 : 0) + '%';
    let d = '';
    for (let i = 0; i <= 24; i++) {
      const x = i / 24;
      const g = shape(side === 'in' ? x : 1 - x, curve);
      d += (i ? 'L' : 'M') + (x * 100).toFixed(2) + ' ' + ((1 - g) * 100).toFixed(2) + ' ';
    }
    el.querySelector('.sq-fade__line').setAttribute('d', d);
    el.querySelector('.sq-fade__area').setAttribute('d', d + 'L' + (side === 'in' ? '0 0' : '100 0') + ' Z');
    const mid = el.querySelector('.sq-fade__h--curve');
    mid.style.left = '50%';
    mid.style.top = ((1 - shape(0.5, curve)) * 100) + '%';
  });
}
```

페이드가 없으면 폭을 0으로 하고 핸들은 클립 끝에 둡니다. 핸들을 끌어서 처음 페이드를 만들 수 있게 하기 위해서입니다. 나가는 페이드는 올라가는 모양을 좌우로 뒤집어 그립니다.

### 3.4 끌기와 저장

```javascript
function startDrag(e) {
  const h = e.target.closest ? e.target.closest('.sq-fade__h') : null;
  if (!h || e.button !== 0) return;
  const clip = h.closest('.sq-clip');
  if (!clip) return;
  e.preventDefault();
  e.stopPropagation();
  adopt(clip);
  const side = h.dataset.side;
  const key = side === 'in' ? 'fadeIn' : 'fadeOut';
  const other = side === 'in' ? 'fadeOut' : 'fadeIn';
  const what = h.dataset.what;
  const rect = clip.getBoundingClientRect();
  const px = barPx(clip);
  const len = lengthBars(clip);
  clip.classList.add('is-fading');
  function move(ev) {
    if (what === 'len') {
      const fromEdge = side === 'in' ? ev.clientX - rect.left : rect.right - ev.clientX;
      let bars = Math.round(fromEdge / px * 100) / 100;
      bars = Math.min(Math.max(bars, 0), Math.max(0, len - num(clip, other)));
      clip.dataset[key] = String(bars);
    } else {
      const box = clip.querySelector('.sq-fade--' + side).getBoundingClientRect();
      if (box.height > 0) clip.dataset[key + 'Curve'] = String(curveForMid(1 - (ev.clientY - box.top) / box.height));
    }
    renderFades(clip);
  }
  function up() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    clip.classList.remove('is-fading');
    save(clip);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function save(clip) {
  const id = clip.dataset.clipId;
  if (!id) return;
  const body = {
    fade_in_tick: Math.round(num(clip, 'fadeIn') * TICKS_PER_BAR),
    fade_out_tick: Math.round(num(clip, 'fadeOut') * TICKS_PER_BAR),
    fade_in_curve: Math.round(num(clip, 'fadeInCurve') * 100) / 100,
    fade_out_curve: Math.round(num(clip, 'fadeOutCurve') * 100) / 100,
  };
  const rec = clipRecord(id);
  if (rec) Object.assign(rec, body);
  api.patch('/clips/' + encodeURIComponent(id), body).then(function () { markDirty('clip'); })
    .catch(function (err) { if (window.console) console.warn('[fade] save failed', err); });
}
```

| 규칙 | 이유 |
|---|---|
| 포인터 이벤트를 캡처 단계에서 받음 | 클립을 옮기는 기존 끌기보다 먼저 받아 두 동작이 섞이지 않게 합니다. |
| 끌 때마다 그리고, 놓을 때 한 번 저장 | 끌기 중 서버 요청이 쌓이지 않습니다. |
| 반대쪽 페이드와 겹치지 않게 제한 | 319의 `fadeLengths`와 같은 규칙을 화면에서도 지킵니다. |
| 저장 직전에 `clipRecord`도 갱신 | 재생이 화면에서 읽는 기록과 서버 값이 어긋나지 않게 합니다. |

### 3.5 지우기, 켜고 끄기, 길이 변화

```javascript
function removeFade(e) {
  const h = e.target.closest ? e.target.closest('.sq-fade__h') : null;
  if (!h) return;
  const clip = h.closest('.sq-clip');
  const key = h.dataset.side === 'in' ? 'fadeIn' : 'fadeOut';
  clip.dataset[key] = '0';
  clip.dataset[key + 'Curve'] = '0';
  renderFades(clip);
  save(clip);
}

function toggleFades() {
  document.querySelectorAll('.sq-clip--audio.is-selected').forEach(function (clip) {
    adopt(clip);
    const has = num(clip, 'fadeIn') > 0 || num(clip, 'fadeOut') > 0;
    const v = has ? 0 : Math.min(DEFAULT_FADE_BARS, lengthBars(clip) / 2);
    clip.dataset.fadeIn = String(v);
    clip.dataset.fadeOut = String(v);
    if (has) { clip.dataset.fadeInCurve = '0'; clip.dataset.fadeOutCurve = '0'; }
    renderFades(clip);
    save(clip);
  });
}

function clampToLength(clip) {
  const len = lengthBars(clip);
  const fi = Math.min(num(clip, 'fadeIn'), len);
  const fo = Math.min(num(clip, 'fadeOut'), Math.max(0, len - fi));
  if (fi !== num(clip, 'fadeIn')) clip.dataset.fadeIn = String(fi);
  if (fo !== num(clip, 'fadeOut')) clip.dataset.fadeOut = String(fo);
}
```

기본 페이드 길이는 클립 길이의 절반을 넘지 않게 합니다. 짧은 클립에서 두 페이드가 겹치지 않게 하려는 것입니다. 클립 길이가 줄어들면 `MutationObserver`가 `style` 변화를 보고 `clampToLength`로 페이드를 길이 안에 넣습니다.

### 3.6 최신 문법으로 쓰면

```javascript
// 전통 문법 (실제 코드)
const h = e.target.closest ? e.target.closest('.sq-fade__h') : null;
// 최신 문법
const h = e.target.closest?.('.sq-fade__h') ?? null;

// 전통 문법 (실제 코드)
clip.dataset.fadeIn = String(rec ? (Number(rec.fade_in_tick) || 0) / TICKS_PER_BAR : 0);
// 최신 문법
clip.dataset.fadeIn = String((Number(rec?.fade_in_tick) || 0) / TICKS_PER_BAR);

// 전통 문법 (실제 코드)
const found = n.classList.contains('sq-clip--audio') ? [n] : Array.prototype.slice.call(n.querySelectorAll('.sq-clip--audio'));
// 최신 문법
const found = n.classList.contains('sq-clip--audio') ? [n] : [...n.querySelectorAll('.sq-clip--audio')];
```
