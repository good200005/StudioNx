# JS 149 — `isProtectedImage()`와 `initImageProtection()` (Nyxi 일러스트 저장 방지)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/protect-images.js` (새 파일), 호출은 `pages/home.js`, `pages/error.js`, 모양 규칙은 `css/base.css` |
| 작업 | P1-27: 일러스트를 오른쪽 클릭 메뉴와 끌기로 저장하지 못하게 막기 |
| 작성 | Claude (AI), 2026-10-14, 사용자 검토 |
| 브랜치 | `feature/phase1/p1-27-protect-illustrations` (`develop`에서 만듦) |

## 1. 하는 일
| 수단 | 막는 것 |
|---|---|
| `initImageProtection()`: `contextmenu` 이벤트 취소 | 그림 위의 오른쪽 클릭 메뉴("이미지를 다른 이름으로 저장") |
| `initImageProtection()`: `dragstart` 이벤트 취소 | 그림을 끌어서 바탕화면이나 다른 창에 놓기 |
| `base.css`: `-webkit-user-drag: none`, `user-select: none`, `-webkit-touch-callout: none` | 끌기, 선택, 모바일의 길게 눌러 저장 |
| 그림의 `draggable="false"` | 끌기 시작 자체를 거부 |

대상은 `src`에 `characters/nyxi/`가 들어간 `img`입니다. `isProtectedImage(target)`이 그 판단을 하고, 글자나 다른 곳의 오른쪽 클릭 메뉴는 그대로 둡니다.

## 2. 코드
```js
export const PROTECTED_SELECTOR = 'img[src*="characters/nyxi/"]';

export function isProtectedImage(target) {
  return !!(target && target.nodeType === 1 && target.matches && target.matches(PROTECTED_SELECTOR));
}

export function initImageProtection(doc) {
  const root = doc || document;
  const block = function (event) {
    if (isProtectedImage(event.target)) event.preventDefault();
  };
  root.addEventListener('contextmenu', block);
  root.addEventListener('dragstart', block);
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const isProtectedImage = (target) => target?.matches?.(PROTECTED_SELECTOR) ?? false;

export const initImageProtection = (doc = document) => {
  const block = (event) => { if (isProtectedImage(event.target)) event.preventDefault(); };
  ['contextmenu', 'dragstart'].forEach((type) => doc.addEventListener(type, block));
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `target?.matches?.(…)` | `target && target.nodeType === 1 && target.matches && target.matches(…)` | 값이 없거나 요소가 아니면 건너뜁니다 |
| `?? false` | `!!( … )` | 결과를 참과 거짓으로 맞춥니다 |
| `doc = document` | `doc || document` | 인자가 없으면 기본값을 씁니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 문서 전체에 한 번만 연결하고 대상은 `event.target`으로 판단 | 나중에 생기는 그림(공지 없음 화면 등)도 따로 연결하지 않아도 적용됩니다 |
| 다른 곳의 오른쪽 클릭은 막지 않음 | 글자 복사, 링크 새 탭 열기 같은 정상적인 사용을 방해하지 않기 위해서입니다 |
| `src`에 `characters/nyxi/`가 있는 그림만 | 일러스트가 아닌 아이콘, 로고까지 막지 않습니다 |

## 4. 한계 (중요)
**이 방식은 완전한 보호가 아닙니다.** 가벼운 저장 시도만 막습니다.
- 개발자 도구의 네트워크 탭이나 "페이지 소스 보기"로 이미지 주소를 알면 직접 내려받을 수 있습니다.
- 화면 캡처는 막을 수 없습니다.
- 주소(`/static/characters/nyxi/poses/error.png`)를 직접 열면 저장할 수 있습니다.
- JS를 끈 브라우저에서는 오른쪽 클릭 방지가 동작하지 않습니다(끌기와 선택 방지는 CSS라서 동작합니다).

더 강하게 막으려면 이미지를 서버가 로그인과 `Referer`를 검사해서 내보내거나, 워터마크를 넣는 방법이 있습니다. 필요하면 별도 작업으로 다룹니다.

## 5. 시험 (실제 서버, 헤드리스 Chrome, 8개 통과)
| 확인 | 결과 |
|---|---|
| 404 페이지의 그림 1개와 홈의 그림 3개에서 `contextmenu`가 취소됨 | ✔ |
| 같은 그림들에서 `dragstart`가 취소됨 | ✔ |
| 그림의 `user-select`, `user-drag`가 `none` | ✔ |
| 제목 글자의 오른쪽 클릭은 취소되지 않음 | ✔ |

홈의 히어로 그림과 캐릭터 그림은 이미 `home.css`에서 `pointer-events: none`으로 막혀 있어서(클릭이 그림을 통과해 뒤 배경으로 감) 오른쪽 클릭 메뉴에 그림 저장이 원래 나오지 않습니다. 이번 작업은 이 규칙이 없던 일러스트(오류 페이지, 공지 없음 화면)와 모든 Nyxi 그림에 같은 보호를 공통으로 적용한 것입니다. 시험의 홈 그림 3개는 이 두 그림과 공지 없음 그림입니다.
