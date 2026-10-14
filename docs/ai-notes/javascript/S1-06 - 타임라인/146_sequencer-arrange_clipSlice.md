# JS 146 — 클립 분할 배선 (Slice 도구, `splitClip`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-arrange.js` |
| 작업 | S1-06 타임라인: 서른두 번째 작업 (FR-208 클립 분할) |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/s1-06-timeline` |
| 다음 | FR-209 가로·세로 줌 배선을 이어서 진행합니다 |

## 1. 하는 일
**Slice (C)** 도구로 클립을 누르면 누른 자리를 격자에 맞춰 **둘로** 가릅니다. 두 토막이 각각 한 칸 이상일 때만 가르고, 너무 끝에 가까우면(한 칸 미만) 가르지 않습니다.

```
[■■■■ Lead ]                 ← Slice 로 가운데 클릭
[■■ Lead ][■■ Lead ]         ← 두 토막 (각각 한 칸 이상일 때만)

[■■■■ Lead ]                 ← 끝 3px 을 클릭 (한 칸 미만)
[■■■■ Lead ]                 ← 가르지 않음
```

- 자른 자리는 격자에 맞추고, 왼쪽 토막은 `--l` 이 줄고 오른쪽 토막이 그 뒤에 새로 생깁니다.
- 오디오는 오른쪽 토막의 오프셋(`--o`)이 **왼쪽 길이만큼 커져** 원본에서 이어서 들립니다.
- Mute 된 클립을 자르면 오른쪽 토막도 Mute 를 이어받습니다.

| 클립 | 왼쪽 토막 | 오른쪽 토막 |
|---|---|---|
| 위치 | 시작 그대로 | 자른 지점 |
| 오프셋 | 그대로 | 원본 오프셋 + 왼쪽 길이 |

## 2. 코드
```js
/** Slice: 누른 자리(격자)에서 둘로 — 두 토막이 각각 한 칸 이상일 때만 가름 (S1-06 FR-208) */
function sliceClip(clip, bar, free) {
  const s = parseFloat(clip.style.getPropertyValue('--s')) || 0;
  const l = parseFloat(clip.style.getPropertyValue('--l')) || 1;
  const offset = parseFloat(clip.style.getPropertyValue('--o')) || 0;
  const stepTicks = barsToTicks(snapUnit(free));   // Alt = 격자 무시(1틱)
  // 오디오는 원본 처음(start − offset)을 넘겨야 오른쪽 토막 오프셋이 이어짐. MIDI 는 null
  const source = clip.classList.contains('sq-clip--audio') ? barsToTicks(s) - barsToTicks(offset) : null;
  const at = snap(bar, free);
  const res = splitClip(barsToTicks(s), barsToTicks(l), barsToTicks(at), stepTicks, source);
  if (!res) return;
  clip.style.setProperty('--s', round(ticksToBars(res.left.start)));
  clip.style.setProperty('--l', round(ticksToBars(res.left.length)));
  clip.style.setProperty('--o', round(ticksToBars(res.left.offset)));
  const right = createClip({ ...templateOf(clip), start: round(ticksToBars(res.right.start)), length: round(ticksToBars(res.right.length)) });
  right.style.setProperty('--o', round(ticksToBars(res.right.offset)));
  if (clip.classList.contains('is-muted')) right.classList.add('is-muted');
  clip.after(right);
  onChange({ type: 'slice', clip, right, trackId: clip.closest('.sq-track').dataset.trackId, at: round(ticksToBars(res.right.start)), offset: round(ticksToBars(res.right.offset)) });
}
```
**최신 문법으로 쓰면** (공부용)
```js
const right = createClip({ ...templateOf(clip), start: round(ticksToBars(res.right.start)), length: round(ticksToBars(res.right.length)) });
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `{ ...t, start, length }` | 같은 코드 | `templateOf(clip)` 결과에 시작·길이를 덮어씀 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| `splitClip()` 재사용 | 자르기 규칙(스냅·최소 한 칸·오프셋 이어짐)을 이미 시험했습니다(124). 예전 프로토타입은 이 규칙을 손으로 다시 적어 오프셋 방향이 반대였습니다 |
| 최소 한 칸 검사 | 아주 짧은 토막이 생기면 고르기도 지우기도 어렵습니다. `splitClip` 이 `null` 을 돌려주면 그냥 무시 |
| 왼쪽 토막을 원래 클립에 | 새로 만드는 클립을 하나로 줄여, 이름·선택·Mute 등 원래 상태가 그대로 남습니다 |
| `source = start − offset` | 오디오가 원본에서 이어지려면 기준점이 필요합니다. 트리밍(144)과 같은 방식 |
| Mute 이어받기 | 잘라도 소리 상태가 같아야 자연스럽습니다 |

## 4. 시험
**(1) Node 단위 시험** — 모듈 적재 확인(11개 통과). `splitClip` 은 124에서 통과.

**(2) 브라우저 확인(Chrome headless + CDP 실제 마우스 이벤트, 실제 `studioNx.html`)** — Slice 도구(단축키 C)로 클립을 눌렀습니다.
| 확인 | 결과 |
|---|---|
| Slice 도구 선택(`.sq` 클래스 `tool-slice`) | ✔ |
| MIDI(시작 0·길이 4) 가운데 클릭 → 클립 3 → 4, 왼쪽 0·2 / 오른쪽 2·2 | ✔ |
| 끝 3px 클릭(한 칸 미만) → 가르지 않음(4 → 4) | ✔ |
| 오디오(시작 2·길이 10·오프셋 2) 가운데 클릭 → 왼쪽 2·5·2 / 오른쪽 7·5·**7**(= 2 + 5) | ✔ |
