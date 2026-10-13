// 페이지 데이터를 받다가 실패했을 때 어디로 보낼지 정하는 공통 함수 (P1-17 에서 만듦)
// 쓰는 곳: pages/mypage.js (userinfo.js · myproject.js 는 같은 규칙을 자기 파일에 따로 갖고 있음)

import { loginUrl } from './auth.js';

/** 오류 화면이 있는 상태 코드 (errors/<상태>.html) */
const ERROR_PAGES = [400, 403, 404, 429, 500, 503, 504];

/**
 * 페이지를 그리는 데 꼭 필요한 데이터를 못 받았을 때 알맞은 화면으로 옮겨 간다 (2026-10-06 결정).
 * - 401 (로그인이 풀림) → 로그인 주소 (돌아올 주소를 next 로 실음)
 * - 400 · 403 · 404 · 429 · 503 · 504 → 같은 번호의 오류 화면
 * - 그 밖의 500 이상 (예: 502) → 500
 * - 서버에 닿지 못함 (status 0) → 503
 * - `location.replace` 라서 방문 기록에 지금 페이지를 남기지 않음 (뒤로 가기로 깨진 화면에 돌아오지 않게)
 * (구현: AI — 2026-10-12, 함수 하나씩 검토)
 * @param {{ status: number }} err api.js 가 던진 ApiError
 */
export function redirectOnLoadError(err) {
  if (err.status === 401) {
    location.replace(loginUrl(location.pathname + location.search + location.hash));
    return;
  }
  let page = 500;
  if (ERROR_PAGES.indexOf(err.status) >= 0) page = err.status;
  else if (err.status === 0) page = 503;
  location.replace('errors/' + page + '.html');
}
