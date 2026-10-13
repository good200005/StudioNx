// 개인정보 처리방침 링크를 읽는 사람의 언어에 맞는 판으로 연결 (P1-25)
// 처리방침은 privacy.html(영어), privacy.ko.html(한국어), privacy.ja.html(일본어) 세 판이 있음.
// 푸터, 문의 모달, 가입 동의 문구의 링크는 모두 영어판 주소(privacy.html)로 적혀 있고,
// 페이지가 열릴 때 브라우저 언어가 한국어나 일본어이면 그 판의 주소로 바꿈 (core/include.js 가 부름).
// 링크만 바꿀 뿐 페이지를 자동으로 옮기지는 않으며, 처리방침 안에서는 언어 전환 링크로 직접 바꿀 수 있음.

/** 처리방침의 언어별 파일 */
export const PRIVACY_PAGES = { en: 'privacy.html', ko: 'privacy.ko.html', ja: 'privacy.ja.html' };

/**
 * 브라우저 언어 목록으로 보여 줄 처리방침 파일을 고름
 * - 목록은 선호 순서: 처음으로 지원하는 언어(en, ko, ja)가 이김. 예: ['fr-FR', 'ko'] → 한국어판
 * - 지역 표시는 무시 ('ko-KR', 'ja-JP' 의 앞부분만 봄), 대소문자 무시
 * - 지원하는 언어가 하나도 없거나 목록이 이상하면 영어판
 * (구현: AI — 2026-10-13, P1-25, 함수 하나씩 검토)
 * @param {string[]|string|null|undefined} languages  navigator.languages 또는 navigator.language
 * @returns {string} 'privacy.html' | 'privacy.ko.html' | 'privacy.ja.html'
 */
export function pickPrivacyPage(languages) {
  const list = typeof languages === 'string' ? [languages] : (Array.isArray(languages) ? languages : []);
  for (const tag of list) {
    if (typeof tag !== 'string') continue;
    const primary = tag.trim().toLowerCase().split('-')[0].split('_')[0];
    if (PRIVACY_PAGES[primary]) return PRIVACY_PAGES[primary];
  }
  return PRIVACY_PAGES.en;
}

/**
 * 페이지 안의 처리방침 링크(href 가 정확히 "privacy.html")를 읽는 사람의 언어판 주소로 바꿈
 * - 대상: 푸터의 Privacy Policy, 문의 모달의 Read the full Privacy Policy, 가입 동의 문구의 Privacy Policy
 * - 대상이 아닌 것: 처리방침 안의 언어 전환 링크(.policy__lang)는 영어판 링크도 그대로 영어판이어야 하므로 건드리지 않음,
 *   목차 링크("privacy.html#who")는 href 가 정확히 같지 않아서 해당 없음
 * - 영어이면 바꿀 것이 없음. 두 번 불러도 같은 결과 (이미 바뀐 링크는 더 이상 대상이 아님)
 * - 바꾼 링크에는 hreflang 을 달아 어느 언어판인지 알림
 * (구현: AI — 2026-10-13, P1-25, 함수 하나씩 검토)
 * @param {ParentNode} [root=document]
 * @param {string[]|string} [languages=navigator.languages]
 * @returns {number} 바꾼 링크의 개수
 */
export function localizePrivacyLinks(root, languages) {
  const scope = root || document;
  const langs = languages === undefined
    ? ((typeof navigator !== 'undefined' && (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])) || [])
    : languages;
  const page = pickPrivacyPage(langs);
  if (page === PRIVACY_PAGES.en) return 0;

  let changed = 0;
  const links = scope.querySelectorAll('a[href="privacy.html"]');
  for (const link of links) {
    if (link.closest('.policy__lang')) continue;
    link.setAttribute('href', page);
    link.setAttribute('hreflang', page === PRIVACY_PAGES.ko ? 'ko' : 'ja');
    changed += 1;
  }
  return changed;
}
