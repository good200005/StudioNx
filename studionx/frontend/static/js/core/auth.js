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
 * (구현: AI — 2026-10-06, 함수 하나씩 검토)
 */
export async function isLoggedIn() {
  if (getAccessToken()) return true;
  return refreshAccessToken();
}

/**
 * 로그인이 필요한 페이지 맨 처음에 호출
 * @returns {Promise<boolean>} 로그인 상태면 true, 아니면 이동하고 false
 * TODO:
 * - await isLoggedIn() 가 false 면
 *   location.replace(loginUrl(location.pathname + location.search)) 후 false
 * (구현: AI — 2026-10-06, 함수 하나씩 검토) 해시(#new 등)까지 돌아올 주소에 넣음
 */
export async function requireLogin() {
  if (await isLoggedIn()) return true;
  location.replace(loginUrl(location.pathname + location.search + location.hash));
  return false;
}

/**
 * 로그인 모달로 가는 주소
 * @param {string} [next]  로그인 후 돌아갈 경로 (예: '/myPage.html')
 * @returns {string}  예: 'home.html#login?next=%2FmyPage.html'
 * TODO: next 가 있으면 encodeURIComponent 해서 붙이고, 없으면 'home.html#login'
 * (구현: AI — 2026-10-06, 함수 하나씩 검토) 안전한 경로(safeNextPath)일 때만 next 를 붙임
 */
export function loginUrl(next) {
  const path = safeNextPath(next);
  return path ? `${LOGIN_PAGE}#login?next=${encodeURIComponent(path)}` : `${LOGIN_PAGE}#login`;
}

/**
 * 주소의 #login?next=... 읽기 (home.js 의 initLoginModalFromHash 에서 사용)
 * @param {string} [hash=location.hash]
 * @returns {{ open: boolean, next: string|null }}
 * TODO:
 * - hash 가 '#login' 으로 시작하면 open = true
 * - '?' 뒤를 URLSearchParams 로 읽어 next 를 꺼내고 safeNextPath 로 검사
 * (구현: AI — 2026-10-06, 함수 하나씩 검토)
 */
export function parseLoginHash(hash = location.hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#login')) return { open: false, next: null };
  const rest = hash.slice('#login'.length);               // '' 또는 '?next=…'
  if (rest && !rest.startsWith('?')) return { open: false, next: null };   // '#loginHelp' 같은 다른 해시
  const next = new URLSearchParams(rest.slice(1)).get('next');           // %2F → / 로 되돌려 줌
  return { open: true, next: safeNextPath(next) };
}

/**
 * 로그인 후 이동할 경로가 안전한지 검사 (외부 사이트로 보내는 공격 막기 — open redirect)
 * @param {string|null} next
 * @returns {string|null}  안전하면 그대로, 아니면 null
 * TODO:
 * - '/' 로 시작하고 '//' 로 시작하지 않는 같은 사이트 경로만 허용
 *   (또는 new URL(next, location.origin).origin === location.origin)
 * - 'javascript:' 등은 거부
 * (구현: AI — 2026-10-06, 함수 하나씩 검토)
 * @param {string} [origin=location.origin]  비교할 우리 사이트 주소 (시험용으로만 바꿈)
 */
export function safeNextPath(next, origin = location.origin) {
  if (typeof next !== 'string' || !next.startsWith('/')) return null;   // 상대 경로 · 'https://…' · 'javascript:' 거부
  if (next.startsWith('//') || next.includes('\\')) return null;      // '//evil.com' · '/\evil.com' = 다른 사이트
  try {
    return new URL(next, origin).origin === origin ? next : null;     // 브라우저가 해석해도 우리 사이트인지 마지막 확인
  } catch {
    return null;
  }
}

/**
 * 로그아웃 (PRD 01 FR-104)
 * TODO:
 * - await api.post('/auth/logout') — 실패(이미 만료 등)해도 계속 진행 (try/catch)
 *   (서버가 리프레시 쿠키 삭제)
 * - clearAccessToken()
 * - location.href = LOGIN_PAGE  (home.html — 헤더가 Sign In·Join Us 로 돌아옴)
 * (구현: AI — 2026-10-06, 함수 하나씩 검토)
 * - auth:false — 토큰이 없어도 재발급을 시도하지 않고 바로 로그아웃 요청 (서버는 쿠키만 지움)
 * - href 대신 replace — 뒤로 가기로 로그인 전용 페이지가 다시 보이지 않게
 */
export async function logout() {
  try {
    await api.post('/auth/logout', undefined, { auth: false });
  } catch {
    // 이미 만료 · 네트워크 오류여도 화면에서는 로그아웃을 계속함
  }
  clearAccessToken();
  location.replace(LOGIN_PAGE);
}
