// Nyxi 일러스트를 오른쪽 클릭 메뉴("이미지를 다른 이름으로 저장")와 끌어서 저장으로 쉽게 가져가지 못하게 함 (P1-27)
// 완전한 보호는 아님: 개발자 도구, 화면 캡처, 주소 직접 열기는 막을 수 없음. 가벼운 저장 시도만 막는 장치.
// 모양쪽 규칙(끌기 방지, 선택 방지)은 static/css/base.css 의 img[src*="characters/nyxi/"]

/** 보호할 그림: Nyxi 캐릭터 일러스트 (src 에 characters/nyxi/ 가 들어간 img) */
export const PROTECTED_SELECTOR = 'img[src*="characters/nyxi/"]';

/**
 * 이벤트가 일어난 곳이 보호할 그림인지
 * - 그림 위에서 일어난 오른쪽 클릭과 끌기만 막고, 다른 곳의 오른쪽 클릭 메뉴는 그대로 둠
 * (구현: AI — 2026-10-14, P1-27, 함수 하나씩 검토)
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
export function isProtectedImage(target) {
  return !!(target && target.nodeType === 1 && target.matches && target.matches(PROTECTED_SELECTOR));
}

/**
 * 오른쪽 클릭 메뉴와 끌기를 막음 (문서 전체에 한 번만 연결, 나중에 생긴 그림도 적용됨)
 * @param {Document} [doc=document]
 */
export function initImageProtection(doc) {
  const root = doc || document;
  const block = function (event) {
    if (isProtectedImage(event.target)) event.preventDefault();
  };
  root.addEventListener('contextmenu', block);
  root.addEventListener('dragstart', block);
}
