// myPage.html 페이지 스크립트 (템플릿 — 구현은 직접, P1-17)
// 화면 모양은 HTML·CSS로 완성되어 있고(지금 값은 예시), 여기서는 API 값으로 바꿔 넣는 일만 합니다.
// 데이터: GET /api/v1/me/dashboard (PRD 01 §7) — 응답 예시는 아래 loadDashboard 주석

import { initAuthState } from '../core/auth-ui.js';
import { requireLogin, logout } from '../core/auth.js';
import { includePartials } from '../core/include.js';
import { initDesktopOnlyLinks } from '../core/studio.js';

/** 하루 칸을 꽉 채우는 작업 시간 (초) — 8시간. 세션 막대 너비 = active_seconds ÷ DAY_FULL_SECONDS */
export const DAY_FULL_SECONDS = 8 * 60 * 60;

/** 저장 용량 경고 기준 (FR-133) — 이 비율 이상이면 .strip 에 is-warn (빨간 미터) */
export const STORAGE_WARN_RATIO = 0.8;

/**
 * 대시보드 데이터 받기
 * - const data = await api.get('/me/dashboard')   (core/api.js)
 * - 응답 예시 (서버 P1-17 백엔드와 맞춰 정하기):
 *   {
 *     user:    { nickname, email, created_at, profile_image_url },
 *     storage: { quota_bytes, used_bytes, by_kind: { samples, exports, stems, snapshots } },
 *     ai:      { analyses: { used, limit }, questions: { used, limit } },   // 오늘 기준, 자정 초기화
 *     ready_projects: [                                                // 아직 시퀀서에서 안 연 프로젝트 (내 세션 0개), 최근 생성순 (FR-130)
 *       { project_id, title, bpm, time_sig_num, time_sig_den, created_at } ],
 *     recent_projects: [
 *       { project_id, title, bpm, music_key, updated_at,
 *         sessions: [ { started_at, last_seen_at, active_seconds } ] }    // 최근 7일, 내 세션만 (project_sessions)
 *     ]
 *   }
 * - 실패하면 (2026-10-06 결정) 404 → location.replace('errors/404.html'), 403 → errors/403.html, 500 이상 → errors/500.html
 * @returns {Promise<object>}
 */
export async function loadDashboard() {
  // TODO
}

/**
 * 프로필 카드 채우기
 * - #profile-name ← nickname, #profile-email ← email, #profile-joined ← created_at 을 'Oct 2026' 형식으로
 * - #profile-avatar: 사진이 있으면 안에 <img src alt=""> 넣기, 없으면 닉네임 첫 글자(대문자)
 */
export function renderProfile(user) {
  // TODO
}

/**
 * 사용량 미터 채우기 (FR-133·136)
 * - [data-usage="samples|exports|stems|snapshots|total|analyses|questions"] 마다
 *   .strip__meter i 의 style --p 를 '18.8%' 처럼 (값 ÷ 한도 × 100, 최대 100)
 *   .strip__value 숫자 (바이트 → GB 소수 둘째 자리 / AI 는 '2' + <small>/5</small>)
 *   .strip__meter aria-label 도 같은 값으로 (예: 'Samples 0.94 of 5 GB')
 * - total 이 STORAGE_WARN_RATIO 이상이면 total .strip 에 is-warn
 * - #usage-storage ← '1.86 / 5 GB'
 */
export function renderUsage(storage, ai) {
  // TODO
}

/**
 * 최근 프로젝트 5개 + 최근 7일 작업 시간 (FR-121·128)
 * 1) 요일 눈금 #recent-days: 오늘 포함 지난 7일 (브라우저 시간대 기준). 마지막 칸은 'Today' + is-today
 * 2) #recent-list 비우고 프로젝트마다 li.lane 만들기 (지금 HTML 의 li 구조 그대로)
 *    - .lane__head href = `studioNx.html?projectId=${project_id}`, 제목·'128 BPM · A minor · 12 minutes ago'
 *    - 세션을 started_at 의 날짜(로컬)로 7칸에 나누기 → 칸마다 <i style="--w: …%" title="Fri 2 · 19:30–22:00 · 2h 30m">
 *      --w = min(100, active_seconds ÷ DAY_FULL_SECONDS × 100)
 *      (자정을 넘긴 세션은 시작한 날에 표시)
 *    - .lane__sum ← 7일 active_seconds 합계, formatDuration 으로
 *    - .lane__days aria-label ← 'Midnight Drive: 9 hours in the last 7 days'
 * 3) #recent-week-total ← 모든 프로젝트 합계
 * 4) 프로젝트가 0개면 #recent-list·#recent-days 숨기고 #recent-empty 의 hidden 해제
 * - 줄 색은 CSS 가 순서대로 정함 (mypage.css .lane:nth-child)
 * - 모바일은 CSS 가 요일 칸을 숨기고 합계만 보여 줌 → JS 는 PC·모바일 구분 없이 같은 HTML
 */
export function renderRecentProjects(projects) {
  // TODO
}

/**
 * 이어 하기 배너 (FR-130) — #ready-banner
 * - projects 가 비었으면 hidden
 * - 이 브라우저에서 × 로 닫은 프로젝트(localStorage 'studionx.readyDismissed' = ID 배열)는 빼고 첫 번째를 보여 줌
 *   (localStorage 는 개인 창 등에서 막힐 수 있으니 try/catch — 실패하면 그냥 보여 줌)
 * - #ready-title ← 제목, #ready-open href = `studioNx.html?projectId=${id}`
 * - .ready__meta ← 'Not opened yet · created 5 minutes ago · 120 BPM · 4/4'
 * - 남은 개수가 있으면 #ready-more ' · 1 more in My Projects', 없으면 #ready-more hidden
 * - #ready-close: 그 ID를 저장하고 배너 숨김 (다음 안 연 프로젝트는 다음 접속 때)
 * - 폭 1280px 미만에서는 CSS 가 숨김 (시퀀서를 열 수 없으므로)
 */
export function renderReadyBanner(projects) {
  // TODO
}

/**
 * 초 → '9h 00m'
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  // TODO
}

/**
 * 로그아웃 버튼 (#logout-button) → core/auth.js logout() (서버 쿠키 삭제 후 home.html 로)
 * - 누른 뒤 버튼 disabled (두 번 누름 방지)
 */
export function initLogoutButton() {
  // TODO
}

// 공통 헤더·푸터를 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initAuthState();
// TODO: await requireLogin() — 로그인 안 했으면 home.html#login?next=myPage.html 로 보냄 (core/auth.js)
// TODO: const data = await loadDashboard(); renderReadyBanner(data.ready_projects); renderProfile(data.user); renderUsage(data.storage, data.ai); renderRecentProjects(data.recent_projects);
initDesktopOnlyLinks(document.getElementById('recent-list'));   // 작은 화면에서 최근 프로젝트를 누르면 안내 (FR-129)
initLogoutButton();
