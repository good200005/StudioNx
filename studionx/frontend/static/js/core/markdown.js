// Markdown → 안전한 HTML 조각 (공지 본문 등, 관리자가 쓴 글을 방문자 화면에 넣을 때)
// 도구: static/vendor/marked (Markdown → HTML), static/vendor/dompurify (위험한 HTML 제거)
// 둘 다 파일로 넣은 ES 모듈이라 전역 변수를 만들지 않고, sweetalert2 와 서로 영향이 없음 (P1-23)

import { marked } from '../../vendor/marked/marked.esm.js';
import DOMPurify from '../../vendor/dompurify/purify.es.mjs';

/**
 * Markdown 글을 안전한 DOM 조각으로 바꿈
 * - 순서는 항상 marked(Markdown → HTML) → DOMPurify(안전 처리) → 링크 손질. 이 순서를 이 함수 안에 고정해서
 *   부르는 쪽이 안전 처리를 빠뜨릴 수 없게 함 (글을 HTML 로 직접 넣는 곳은 이 함수 하나뿐이어야 함)
 * - 허용하는 것: 글 서식 태그 (제목, 문단, 목록, 굵게, 기울임, 코드, 인용, 표, 링크, 줄바꿈)
 * - 막는 것: script, style, iframe, form 과 입력칸, 그림(img, svg 등 — 외부 주소로 방문 기록이 새는 것도 막음),
 *   on…(onclick, onerror) 속성, http · https · mailto 가 아닌 링크 (javascript:, data: 등)
 * - 링크는 새 창으로 열고 rel="noopener noreferrer" 를 붙임 (허용되지 않는 주소라서 href 가 지워진 링크는 글자로만 남음)
 * - 줄바꿈: 글을 쓸 때 누른 Enter 가 그대로 줄바꿈 (breaks: true)
 * - 글이 아닌 값(null, 숫자 등)은 빈 조각
 * - 글 안의 제목(#)은 모달 제목보다 크게 보이지 않게 CSS 가 크기를 맞춤 (여기서는 태그를 바꾸지 않음)
 * (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
 * @param {string} markdown
 * @returns {DocumentFragment}
 */
export function markdownToFragment(markdown) {
  if (typeof markdown !== 'string' || markdown === '') return document.createDocumentFragment();

  const html = marked.parse(markdown, { gfm: true, breaks: true, async: false });
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'img', 'picture', 'source', 'video', 'audio', 'iframe', 'object', 'embed', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style', 'srcset'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ALLOW_DATA_ATTR: false,
  });

  const links = fragment.querySelectorAll('a');
  for (const link of links) {
    if (!link.hasAttribute('href')) continue;  // 위험한 주소라서 href 가 지워진 링크는 그냥 글자
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  return fragment;
}
