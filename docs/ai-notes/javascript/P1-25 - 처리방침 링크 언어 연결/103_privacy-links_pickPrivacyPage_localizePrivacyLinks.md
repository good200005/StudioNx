# JS 103 — `pickPrivacyPage()`와 `localizePrivacyLinks()` (처리방침 링크를 읽는 사람의 언어판으로)

| 항목 | 내용 |
|---|---|
| 파일 | `studionx/frontend/static/js/core/privacy-links.js` (새 파일), 호출은 `core/include.js`의 `includePartials()` 끝 |
| 작업 | P1-25: 푸터, 문의 모달, 가입 동의 문구의 Privacy Policy 링크를 브라우저 언어에 맞는 판으로 연결 |
| 작성 | Claude (AI), 2026-10-13, 사용자 검토 |
| 이전 | [102 `initLanguageLinks()`](<../P1-24 - 화면 수정과 처리방침 번역/102_privacy_initLanguageLinks.md>) |

## 1. 하는 일
| 함수 | 역할 |
|---|---|
| `pickPrivacyPage(languages)` | 브라우저 언어 목록에서 처음으로 지원하는 언어(en, ko, ja)를 찾아 `privacy.html`, `privacy.ko.html`, `privacy.ja.html` 중 하나를 돌려줍니다. 지원하는 언어가 없으면 영어판입니다 |
| `localizePrivacyLinks(root, languages)` | 페이지 안의 `a[href="privacy.html"]`를 위에서 고른 판의 주소로 바꾸고 `hreflang`을 답니다. 바꾼 개수를 돌려줍니다 |

| 브라우저 언어 | 푸터 링크 |
|---|---|
| `ko-KR` | `privacy.ko.html` |
| `ja` | `privacy.ja.html` |
| `['fr-FR', 'ko']` | `privacy.ko.html` (선호 순서에서 처음 지원하는 언어) |
| `en-US`, `fr`, 비어 있음 | `privacy.html` |

## 2. 코드
```js
export const PRIVACY_PAGES = { en: 'privacy.html', ko: 'privacy.ko.html', ja: 'privacy.ja.html' };

export function pickPrivacyPage(languages) {
  const list = typeof languages === 'string' ? [languages] : (Array.isArray(languages) ? languages : []);
  for (const tag of list) {
    if (typeof tag !== 'string') continue;
    const primary = tag.trim().toLowerCase().split('-')[0].split('_')[0];
    if (PRIVACY_PAGES[primary]) return PRIVACY_PAGES[primary];
  }
  return PRIVACY_PAGES.en;
}

export function localizePrivacyLinks(root, languages) {
  const scope = root || document;
  const langs = languages === undefined
    ? ((typeof navigator !== 'undefined' && (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) || [])
    : languages;
  const page = pickPrivacyPage(langs);
  if (page === PRIVACY_PAGES.en) return 0;
  let changed = 0;
  for (const link of scope.querySelectorAll('a[href="privacy.html"]')) {
    if (link.closest('.policy__lang')) continue;
    link.setAttribute('href', page);
    link.setAttribute('hreflang', page === PRIVACY_PAGES.ko ? 'ko' : 'ja');
    changed += 1;
  }
  return changed;
}
```
**최신 문법으로 쓰면** (공부용)
```js
export const pickPrivacyPage = (languages) => {
  const list = [languages ?? []].flat();
  const hit = list.map((t) => String(t).trim().toLowerCase().split(/[-_]/)[0]).find((p) => p in PRIVACY_PAGES);
  return PRIVACY_PAGES[hit ?? 'en'];
};
```
| 최신 문법 | 실제 코드 | 뜻 |
|---|---|---|
| `languages ?? []` | `typeof`와 `Array.isArray`로 확인 | 값이 없으면 빈 목록으로 봅니다 |
| `.find((p) => p in PRIVACY_PAGES)` | `for` 반복 안의 `if` | 처음으로 지원하는 언어를 찾습니다 |
| `split(/[-_]/)` | `split('-')[0].split('_')[0]` | `ko-KR`, `ko_KR` 모두 앞부분만 봅니다 |

## 3. 왜 이렇게
| 선택 | 이유 |
|---|---|
| 링크만 바꾸고 **페이지를 자동으로 옮기지는 않음** | 처리방침은 법적 문서라서, 읽는 언어는 사용자가 고르는 것이 안전합니다. 링크가 알맞은 판을 가리키는 것만 돕습니다 |
| HTML의 원래 주소는 `privacy.html` 그대로 | JS가 실패해도 영어판으로 가는 링크가 남습니다 |
| `includePartials()` 끝에서 한 번 호출 | 푸터와 문의 모달이 조각 파일(partial)이라서, 끼워 넣은 뒤에 바꿔야 모든 페이지에 한 번에 적용됩니다. 가입 동의 문구도 같은 호출로 바뀝니다 |
| `.policy__lang` 안은 건너뜀 | 처리방침의 언어 전환에서 `English` 링크는 영어판이어야 합니다 |
| 목차 링크(`privacy.html#who`)는 해당 없음 | `href`가 정확히 `privacy.html`이 아니라서 선택되지 않고, 각 판의 목차가 그 판을 가리키는 것이 맞습니다 |
| 두 번 불러도 같은 결과 | 이미 바뀐 링크는 더 이상 `a[href="privacy.html"]`가 아니기 때문입니다 |

## 4. 시험 (실제 서버, 헤드리스 Chrome, 17개 통과)
| 확인 | 결과 |
|---|---|
| `pickPrivacyPage`: 문자열, 배열, 대소문자, `_` 구분, 빈 값, 이상한 값 | ✔ |
| 헤더, 푸터, 문의 모달, 가입 화면의 링크가 en, ko, ja, fr 브라우저에서 각각 알맞은 판 | ✔ |
| 한국어 브라우저에서 푸터 링크를 누르면 `/privacy.ko.html`로 이동 | ✔ |
| 처리방침의 언어 전환 `English` 링크는 `privacy.html` 그대로, 목차 링크는 각 판 그대로 | ✔ |
| 다른 페이지의 푸터, 반복 호출, 화면 오류 없음 | ✔ |
