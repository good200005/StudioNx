# JavaScript 244 — 주소의 프로젝트 번호와 플러그인 표 (`readProjectId` · `loadPlugins`)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/pages/sequencer-devices.js` |
| 작업 | S1-09 악기·이펙트 화면: 어느 프로젝트인지 읽고, 붙일 수 있는 플러그인 표를 읽습니다 (FR-241 · FR-244) |
| 작성 | Claude (AI), 2026-10-18, 사용자 검토 |
| 이전 · 다음 | 243 시작 · 245 트랙과 장치 읽기 |

## 1. 하는 일
두 함수는 화면이 무엇을 그릴지 정하는 첫 재료를 모읍니다. `readProjectId` 는 주소 끝의 `?projectId=12` 에서 `12` 를 꺼내고, 없거나 빈 값이면 `null` 을 돌려줍니다. `loadPlugins` 는 플러그인 표에서 **쓰는 중인 것만** 읽어(FR-241) 모듈 변수 `plugins` 에 담습니다. 카드의 이름, 파라미터 스키마, 고르기 창의 목록이 모두 이 표에서 나옵니다.

## 2. 언제 쓰나
| 쓰는 곳 | |
|---|---|
| `initDevices` (243) | 모드를 정할 때 `readProjectId`, 첫 재료로 `loadPlugins` 를 부릅니다 |
| `openPluginPicker` (259) | 표가 비어 있으면 안내 알림만 띄웁니다 |

## 3. 코드
```js
export function readProjectId() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('projectId');
  return raw ? String(raw) : null;
}

export async function loadPlugins() {
  const res = await api.get('/plugins?active_only=true');
  plugins = (res && res.items) || [];
  return plugins;
}
```

### 문법 풀이
| 식 | 뜻 |
|---|---|
| `typeof window === 'undefined'` | 화면이 없는 환경(시험 도구)에서도 터지지 않게 합니다 |
| `new URLSearchParams(window.location.search)` | 주소의 `?` 뒤 글을 다루기 쉽게 나눕니다 |
| `.get('projectId')` | `projectId` 값 하나를 꺼냅니다. 없으면 `null` |
| `raw ? String(raw) : null` | 빈 글자(`?projectId=`)는 없는 것으로 봅니다 |
| `api.get('/plugins?active_only=true')` | 꺼 둔 플러그인을 빼고 읽습니다 |
| `(res && res.items) || []` | 응답이 예상과 달라도 빈 배열로 시작합니다 |

## 4. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 주소로 프로젝트를 받음 | 프로젝트 목록 화면에서 링크 한 줄로 들어올 수 있습니다 |
| `active_only=true` | 판매 중지나 시험용 플러그인이 목록에 섞이지 않게 합니다 |
| 빈 글자를 `null` 로 | 실제 모드와 데모 모드의 갈림길이라 빈 값을 확실히 걸러야 합니다 |

## 5. 시험
시험 계정으로 로그인한 뒤 `/projects` 에서 "S1-09 UI Test" 의 `project_id` 를 읽어 주소에 붙였고, `?projectId=` 없이 열었을 때는 `null` 이 되어 예시 화면이 그대로 남는 것을 확인했습니다. 플러그인 표는 7종(악기 2 · 이펙트 5)이 읽혔습니다.
