// 로그인 확인 · 이동 · 로그아웃 (뼈대 — 구현은 직접, P1-02)
// 로그인 화면은 별도 페이지가 아니라 home.html 의 모달 → 로그인이 필요하면 home.html#login?next=<원래 페이지>
//
// 쓰는 법 (로그인이 필요한 페이지 — myPage, userInfo, myProject, studioNx):
//   import { requireLogin } from '../core/auth.js';
//   const ok = await requireLogin();   // 로그인 안 됐으면 home.html#login?next=... 로 이동
//   if (!ok) return;

import { api, clearAccessToken, getAccessToken, refreshAccessToken } from './api.js';

export const LOGIN_PAGE = 'home.html';

/**
 * 로그인 상태인지 확인 (토큰이 없으면 리프레시 쿠키로 재발급 시도)
 * @returns {Promise<boolean>}
 * TODO: getAccessToken() 이 있으면 true, 없으면 await refreshAccessToken()
 */
export async function isLoggedIn() {
  // TODO
  return Boolean(getAccessToken());
}

/**
 * 로그인이 필요한 페이지 맨 처음에 호출
 * @returns {Promise<boolean>} 로그인 상태면 true, 아니면 이동하고 false
 * TODO:
 * - await isLoggedIn() 가 false 면
 *   location.replace(loginUrl(location.pathname + location.search)) 후 false
 */
export async function requireLogin() {
  // TODO
  return false;
}

/**
 * 로그인 모달로 가는 주소
 * @param {string} [next]  로그인 후 돌아갈 경로 (예: '/myPage.html')
 * @returns {string}  예: 'home.html#login?next=%2FmyPage.html'
 * TODO: next 가 있으면 encodeURIComponent 해서 붙이고, 없으면 'home.html#login'
 */
export function loginUrl(next) {
  // TODO
  return `${LOGIN_PAGE}#login`;
}

/**
 * 주소의 #login?next=... 읽기 (home.js 의 initLoginModalFromHash 에서 사용)
 * @param {string} [hash=location.hash]
 * @returns {{ open: boolean, next: string|null }}
 * TODO:
 * - hash 가 '#login' 으로 시작하면 open = true
 * - '?' 뒤를 URLSearchParams 로 읽어 next 를 꺼내고 safeNextPath 로 검사
 */
export function parseLoginHash(hash = location.hash) {
  // TODO
  return { open: false, next: null };
}

/**
 * 로그인 후 이동할 경로가 안전한지 검사 (외부 사이트로 보내는 공격 막기 — open redirect)
 * @param {string|null} next
 * @returns {string|null}  안전하면 그대로, 아니면 null
 * TODO:
 * - '/' 로 시작하고 '//' 로 시작하지 않는 같은 사이트 경로만 허용
 *   (또는 new URL(next, location.origin).origin === location.origin)
 * - 'javascript:' 등은 거부
 */
export function safeNextPath(next) {
  // TODO
  return null;
}

/**
 * 로그아웃 (PRD 01 FR-104)
 * TODO:
 * - await api.post('/auth/logout') — 실패(이미 만료 등)해도 계속 진행 (try/catch)
 *   (서버가 리프레시 쿠키 삭제)
 * - clearAccessToken()
 * - location.href = LOGIN_PAGE  (home.html — 헤더가 Sign In·Join Us 로 돌아옴)
 */
export async function logout() {
  // TODO
}
