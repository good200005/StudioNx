// 공통 HTML 조각 끼우기 (구현: AI — 사용자 요청, 2026-10-02)
// 페이지의 <div data-include="static/partials/header.html"></div> 자리를 그 파일 내용으로 바꿈.
// 조각 파일: static/partials/ (header, footer, login-modal) — 한 파일만 고치면 모든 페이지에 반영.
//
// 쓰는 법 (페이지 스크립트 맨 위):
//   import { includePartials } from '../core/include.js';
//   await includePartials();   // 끝난 뒤에 헤더·모달을 찾는 init 함수들을 부름

import { localizePrivacyLinks } from './privacy-links.js';

/**
 * @param {ParentNode} [root=document]
 * @returns {Promise<void>}  모든 조각을 끼우면 끝남. 하나라도 못 받으면 오류를 던짐
 */
export async function includePartials(root = document) {
  const slots = [...root.querySelectorAll('[data-include]')];
  await Promise.all(slots.map(async (slot) => {
    const url = slot.getAttribute('data-include');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`include failed: ${url} (${res.status})`);
    const template = document.createElement('template');
    template.innerHTML = await res.text();
    slot.replaceWith(template.content);
  }));
  // 푸터의 Privacy Policy 같은 처리방침 링크를 읽는 사람의 언어판(한국어, 일본어)으로 (core/privacy-links.js, P1-25)
  localizePrivacyLinks(root);
}
