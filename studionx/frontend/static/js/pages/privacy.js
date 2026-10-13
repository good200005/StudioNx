// privacy.html · privacy.ko.html · privacy.ja.html 페이지 스크립트 — 공통 헤더·푸터·로그인 모달을 끼우고, 목차 표시와 언어 전환 (core/include.js)
import { includePartials } from '../core/include.js';
import { initAuthState } from '../core/auth-ui.js';
import { initModalFallback } from '../core/modal.js';

/**
 * (선택) 목차에서 지금 읽고 있는 절 표시
 * - IntersectionObserver 로 화면 위쪽에 들어온 section 을 찾아
 *   .policy__toc a[href$="#<id>"] 에 aria-current="true" (CSS 는 :hover 와 같은 모양을 쓰면 됨)
 */
export function initTocActiveState() {
  // (구현: AI — 2026-10-13, P1-23, 함수 하나씩 검토)
  // - 화면 위쪽(위에서 10% ~ 20% 사이)의 얇은 띠에 걸친 절을 "지금 읽는 절"로 봄
  // - 띠에 두 절이 함께 걸치면(절 경계) 아래쪽, 즉 막 들어오는 절을 표시함
  // - 글머리(제목, 첫 문단)에서는 어느 목차도 표시하지 않음
  // - 페이지 맨 아래에서는 마지막 절이 띠에 닿지 못할 수 있어서, 맨 아래면 마지막 절을 표시함
  // - IntersectionObserver 를 못 쓰는 브라우저에서는 표시만 안 함 (목차 이동은 그대로 됨)
  const links = document.querySelectorAll('.policy__toc a');
  if (links.length === 0 || typeof IntersectionObserver === 'undefined') return;

  const targets = [];   // { link, section, inside }
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#') + 1) : '';
    const section = hash ? document.getElementById(hash) : null;
    if (section) targets.push({ link: link, section: section, inside: false });
  }
  if (targets.length === 0) return;

  const refresh = function () {
    let current = null;
    for (const target of targets) {
      if (target.inside) current = target;   // 띠에 두 절이 함께 걸치면 새로 들어오는 아래쪽 절
    }
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) current = targets[targets.length - 1];
    for (const target of targets) {
      if (target === current) target.link.setAttribute('aria-current', 'true');
      else target.link.removeAttribute('aria-current');
    }
  };

  const observer = new IntersectionObserver(function (entries) {
    for (const entry of entries) {
      for (const target of targets) {
        if (target.section === entry.target) target.inside = entry.isIntersecting;
      }
    }
    refresh();
  }, { rootMargin: '-10% 0px -80% 0px', threshold: 0 });

  for (const target of targets) observer.observe(target.section);
  window.addEventListener('scroll', function () { window.requestAnimationFrame(refresh); }, { passive: true });
}

/**
 * 언어 전환 링크 (English · 한국어 · 日本語) — 읽던 절을 그대로 이어서 보여 줌
 * - 링크를 누르기 직전에(마우스 누름, 포커스, 클릭) 링크 주소 뒤에 지금 읽는 절의 #번호를 붙임
 *   · 지금 읽는 절 = 목차에서 aria-current 가 달린 항목 (initTocActiveState 가 표시), 없으면 주소의 #…, 둘 다 없으면 붙이지 않음
 *   → '권리' 절을 읽다가 한국어를 누르면 privacy.ko.html#rights 로 열려 같은 절에서 이어서 읽음
 * - 새 탭으로 열기(휠 클릭, 오른쪽 클릭 메뉴)도 같은 주소가 나오도록 클릭만이 아니라 누름과 포커스에서도 고침
 * - 링크의 원래 주소(data-base)는 처음에 한 번만 저장해서, 여러 번 고쳐도 #…가 겹쳐 붙지 않음
 * (구현: AI — 2026-10-13, P1-24, 함수 하나씩 검토)
 */
export function initLanguageLinks() {
  const links = document.querySelectorAll('.policy__lang a');
  for (const link of links) {
    link.setAttribute('data-base', (link.getAttribute('href') || '').split('#')[0]);
    const update = function () {
      const base = link.getAttribute('data-base');
      const current = document.querySelector('.policy__toc a[aria-current="true"]');
      let hash = '';
      if (current) {
        const href = current.getAttribute('href') || '';
        hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : '';
      } else if (location.hash) {
        hash = location.hash;
      }
      link.setAttribute('href', base + hash);
    };
    link.addEventListener('pointerdown', update);
    link.addEventListener('focus', update);
    link.addEventListener('click', update);
  }
}

await includePartials();
initAuthState();
initModalFallback();
initTocActiveState();
initLanguageLinks();
