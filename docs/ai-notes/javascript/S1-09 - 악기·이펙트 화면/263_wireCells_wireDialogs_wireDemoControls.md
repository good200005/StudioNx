# JavaScript 263 — 이벤트 배선과 잔손질 (`wireCells` · `wireChainDrag` · `wireDialogs` · `wireDemoControls` · `startMeters` · `setText` · `warn` · `errText` · `esc`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 칸 · 창 · 예시 화면의 입력을 받아 함수로 잇습니다 (FR-244 · FR-263) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 262 프리셋과 켜고 끄기 · S1-10 갈래 · 커넥트 링크(예정) |

## 1. 하는 일
`wireCells` 는 트랙 목록에 클릭 하나를 걸어 두고, 눌린 곳에 따라 알맞은 함수를 부릅니다. 트랙 머리 버튼이면 저장, V 면 칸 채우기, 카드 안 버튼이면 붙이기 · 바이패스 · 떼기 · 겹 솔로, 카드 몸통이면 상세 모달입니다. 이때 펼침 칸이 트랙 줄의 **형제**라 줄이 잡히지 않는 문제를 한 줄로 해결합니다(칸 앞의 줄을 트랙 줄로 씀). `wireChainDrag` 는 이펙트 카드를 끌어 순서를 바꾸고, `wireDialogs` 는 창 버튼을, `wireDemoControls` 는 예시 화면 조작을 맡습니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `initDevices` (243) | 페이지가 뜰 때 세 배선 함수를 모두 부릅니다 |
| `renderCells` (251) · `saveDeviceModal` (261) | 값이 바뀌면 화면을 다시 그려 배선이 새 요소에 붙습니다 |

## 3. 코드
```js
function wireCells(lanes, onChange) {
  if (!lanes || lanes.dataset.devWired === '1') return;
  lanes.dataset.devWired = '1';
  lanes.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    const acc = e.target.closest('.sq-acc');
    const live = !!acc && acc.classList.contains('is-live');
    // 펼침 칸(.sq-acc)은 트랙 줄(.sq-track)의 형제이므로 칸 안을 누르면 줄이 잡히지 않습니다.
    // 그때는 칸 바로 앞 줄을 트랙 줄로 씁니다.
    let row = e.target.closest('.sq-track');
    if (!row && acc && acc.previousElementSibling) row = acc.previousElementSibling;
    const track = row && row.classList.contains('sq-track') ? trackById(row.dataset.trackId) : null;

    if (track && b && b.closest('.sq-track__head') && b.matches('.sq-power, .is-mute, .is-solo')) {
      window.setTimeout(function () { syncTrackHead(track); }, 0);
      onChange({ type: 'trackState', trackId: track.track_id });
      return;
    }
    if (track && b && b.matches('.sq-expand')) {
      window.setTimeout(function () { ensureLiveCells(track); }, 0);
      return;
    }
    if (!live || !track) return;

    const card = e.target.closest('.sq-fx');
    if (b) {
      if (b.classList.contains('is-dev-add')) {
        const kind = b.dataset.kind === 'INSTRUMENT' ? 'INSTRUMENT' : 'EFFECT';
        openPluginPicker(kind, function (plugin) { addDevice(track, kind, plugin); });
        return;
      }
      if (card && b.classList.contains('sq-fx__power')) { toggleBypass(track, card); return; }
      if (card && b.classList.contains('sq-fx__del')) {
        const device = deviceOfCard(track, card);
        if (device) removeDevice(track, card.dataset.deviceKind, device);
        return;
      }
      if (card && b.classList.contains('sq-irow__solo')) { toggleSolo(track, card); return; }
    }
    // 카드 몸통 · 악기 줄 이름 클릭 → 상세 설정 모달
    if (card && !e.target.closest('[role="slider"]')) {
      const device = deviceOfCard(track, card);
      if (device) openDeviceModal(track, card.dataset.deviceKind, device);
      return;
    }
    onChange({ type: 'deviceClick' });
  });
  wireChainDrag(lanes);
}

/** 재생 중일 때만 미터를 흔드는 타이머 시작 */
export function startMeters() {
  if (meterTimer) return;
  if (typeof window === 'undefined' || !window.setInterval) return;
  meterTimer = window.setInterval(tickMeters, 140);
}

function tickMeters() {
  const bars = document.querySelectorAll('.sq-acc.is-live .sq-meter i, .sq-strip.is-live .sq-meter i');
  if (!bars.length) {
    window.clearInterval(meterTimer);
    meterTimer = 0;
    return;
  }
  const playing = isPlaying();
  Array.prototype.forEach.call(bars, function (bar) {
    const now = parseFloat(bar.style.getPropertyValue('--m')) || 0;
    const next = playing
      ? Math.max(4, Math.min(96, now + (Math.random() * 34 - 14)))
      : Math.max(0, now - 9);
    bar.style.setProperty('--m', Math.round(next) + '%');
  });
}

/** HTML 에 넣을 글 안전하게 */
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
  });
}

/** 오류 알림 + 콘솔 */
function warn(err) {
  showToast(errText(err));
  if (window.console) console.warn('[devices]', err);
}

/** 오류 → 보여 줄 글 */
function errText(err) {
  if (err instanceof ApiError) return err.message || ('Request failed (' + err.status + ')');
  return 'Something went wrong — please try again';
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `lanes.dataset.devWired === '1'` | 배선을 두 번 걸지 않습니다 |
| `e.target.closest('.sq-acc')` | 누른 곳에서 가장 가까운 펼침 칸을 찾습니다 |
| `row = acc.previousElementSibling` | 칸 바로 앞 줄을 트랙 줄로 씁니다 |
| `b.matches('.sq-power, .is-mute, .is-solo')` | 여러 이름 중 하나라도 맞는지 봅니다 |
| `window.setTimeout(..., 0)` | arrange 가 화면을 먼저 바꾼 뒤 값을 읽게 합니다 |
| `!e.target.closest('[role="slider"]')` | 노브를 누른 것은 모달 열기로 보지 않습니다 |
| `window.setInterval(tickMeters, 140)` | 0.14초마다 미터를 흔듭니다 |
| `bar.style.getPropertyValue('--m')` | 지금 막대 길이를 읽습니다 |
| `{ '&': '&amp;', ... }[ch]` | 글자를 안전한 표기로 바꿉니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 클릭 한 곳에서 갈라 처리 | 요소마다 배선하면 다시 그릴 때 빠뜨리기 쉽습니다 |
| 형제 줄 문제를 여기서 해결 | 펼침 칸은 트랙 줄 안이 아니라 옆에 있습니다 |
| 다음 틱에 읽기 | arrange 의 화면 변경이 먼저 끝나야 값이 맞습니다 |
| 미터를 흉내 냄 | 소리 값은 다음 작업(FR-260 대)이라 지금은 움직임만 보여 줍니다 |
| `esc` 로 모두 감쌈 | 사용자가 정한 이름이 화면을 깨뜨리지 않게 합니다 |

## 5. 시험
시험 프로젝트에서 트랙 펼치기, 카드 몸통 클릭으로 모달 열기, 바이패스 · 떼기, 이펙트 끌어 순서 바꾸기, 고르기 창에서 플러그인 붙이기가 모두 동작하고 자바스크립트 오류가 0건인 것을 확인했습니다. 재생 중에만 미터가 흔들리고 멈추면 잦아드는 것도 확인했습니다.
