// myPage.html 페이지 스크립트 (P1-17, 구현: AI — 함수 하나씩 검토)
// 화면 모양은 HTML·CSS로 완성되어 있고(HTML 의 값은 예시), 여기서는 API 값으로 바꿔 넣는 일만 합니다.
// 데이터: GET /api/v1/me/dashboard (PRD 01 §7) — 응답 예시는 아래 loadDashboard 주석

import { initAuthState, initLogoutButton } from '../core/auth-ui.js';
import { requireLogin } from '../core/auth.js';
import { api } from '../core/api.js';
import { includePartials } from '../core/include.js';
import { redirectOnLoadError } from '../core/page-errors.js';
import { formatRelativeTime } from '../core/time.js';
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
 * - 실패하면 (2026-10-06 결정) core/page-errors.js 의 redirectOnLoadError: 401 → 로그인, 400 · 403 · 404 · 429 · 503 · 504 → 같은 번호의 오류 화면,
 *   그 밖의 500 이상 → 500, 서버에 닿지 못함(0) → 503
 * (구현: AI — 2026-10-12, 함수 하나씩 검토)
 * @returns {Promise<object|null>} 대시보드 데이터 (다른 화면으로 옮겨 가면 null)
 */
export async function loadDashboard() {
  try {
    return await api.get('/me/dashboard');
  } catch (err) {
    redirectOnLoadError(err);
    return null;
  }
}

/**
 * 프로필 카드 채우기
 * - #profile-name ← nickname, #profile-email ← email, #profile-joined ← created_at 을 'Oct 2026' 형식으로
 * - #profile-avatar: 사진이 있으면 안에 <img src alt=""> 넣기, 없으면 닉네임 첫 글자(대문자)
 * - 서버 날짜는 UTC 인데 시간대 표시가 없어서(`2026-10-07T01:12:30`) 끝에 Z 를 붙여 읽음 → 이 컴퓨터의 시간대로 'Oct 2026'
 * - 글자는 textContent 로만 넣음 (닉네임에 <b> 같은 글자가 있어도 태그로 해석되지 않게)
 * - 칸이 하나 없어도 나머지는 채움 (화면을 고쳐 칸이 빠져도 오류로 멈추지 않게)
 * (구현: AI — 2026-10-12, 함수 하나씩 검토)
 * @param {{ nickname: string, email: string, created_at: string, profile_image_url: string|null }} user
 */
export function renderProfile(user) {
  const name = document.getElementById('profile-name');
  const email = document.getElementById('profile-email');
  const joined = document.getElementById('profile-joined');
  const avatar = document.getElementById('profile-avatar');

  if (name) name.textContent = user.nickname;
  if (email) email.textContent = user.email;
  if (joined) {
    const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(user.created_at);
    const date = new Date(hasZone ? user.created_at : user.created_at + 'Z');
    joined.textContent = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (avatar) {
    avatar.textContent = '';
    if (user.profile_image_url) {
      const img = document.createElement('img');
      img.src = user.profile_image_url;
      img.alt = ''; // 동그라미는 aria-hidden — 닉네임은 옆에 글자로 있음
      avatar.appendChild(img);
    } else {
      avatar.textContent = user.nickname.charAt(0).toUpperCase();
    }
  }
}

/**
 * 사용량 미터 채우기 (FR-133·136)
 * - [data-usage="samples|exports|stems|snapshots|total|analyses|questions"] 마다
 *   .strip__meter i 의 style --p 를 '18.8%' 처럼 (값 ÷ 한도 × 100, 최대 100)
 *   .strip__value 숫자 (바이트 → GB 소수 둘째 자리 / AI 는 '2' + <small>/5</small>)
 *   .strip__meter aria-label 도 같은 값으로 (예: 'Samples 0.94 of 5 GB')
 * - total 이 STORAGE_WARN_RATIO 이상이면 total .strip 에 is-warn
 * - #usage-storage ← '1.86 / 5 GB'
 * - 한도가 0 이면 비율은 0 (0 으로 나누지 않음), 비율은 0 ~ 100 으로 자르고 소수 첫째 자리까지
 * - 총 사용량(TOTAL)의 빨간 경고선 위치 --w 도 STORAGE_WARN_RATIO 로 맞춤
 * - #usage-reset ← AI 사용량이 0 으로 돌아오는 시각. 서버의 '오늘'은 UTC 0시 기준이므로
 *   그 순간을 이 컴퓨터의 시간대로 바꿔 'HH:MM' 으로 (한국 09:00, 영국 겨울 00:00, 미국 동부 겨울 19:00)
 * (구현: AI — 2026-10-12, 함수 하나씩 검토)
 * @param {{ quota_bytes: number, used_bytes: number, by_kind: object }} storage
 * @param {{ analyses: { used: number, limit: number }, questions: { used: number, limit: number } }} ai
 */
export function renderUsage(storage, ai) {
  const GB = 1024 * 1024 * 1024;
  const quotaGb = Number((storage.quota_bytes / GB).toFixed(2)); // 5368709120 → 5
  const toGb = (bytes) => (bytes / GB).toFixed(2); // 1008981770 → '0.94'
  const percent = (used, limit) => {
    if (!limit) return 0;
    return Math.round(Math.min(100, (used / limit) * 100) * 10) / 10;
  };

  // 칸 하나 채우기: 미터 높이(--p), 숫자(+ 작은 단위), 화면 읽기용 이름
  const fillStrip = (name, pct, number, unit, label) => {
    const strip = document.querySelector('[data-usage="' + name + '"]');
    if (!strip) return null;
    const meter = strip.querySelector('.strip__meter');
    const bar = strip.querySelector('.strip__meter i');
    const value = strip.querySelector('.strip__value');
    if (bar) bar.style.setProperty('--p', pct + '%');
    if (meter) meter.setAttribute('aria-label', label);
    if (value) {
      const small = document.createElement('small');
      small.textContent = unit;
      value.textContent = number;
      value.appendChild(small);
    }
    return strip;
  };

  const kinds = [
    ['samples', 'Samples'],
    ['exports', 'Exports'],
    ['stems', 'Stems'],
    ['snapshots', 'Snapshots'],
  ];
  for (const kind of kinds) {
    const bytes = storage.by_kind[kind[0]];
    fillStrip(kind[0], percent(bytes, storage.quota_bytes), toGb(bytes), 'GB',
      kind[1] + ' ' + toGb(bytes) + ' of ' + quotaGb + ' GB');
  }

  const totalPct = percent(storage.used_bytes, storage.quota_bytes);
  const total = fillStrip('total', totalPct, toGb(storage.used_bytes), 'GB',
    'Total ' + toGb(storage.used_bytes) + ' of ' + quotaGb + ' GB, warning at '
    + Math.round(STORAGE_WARN_RATIO * 100) + '%');
  if (total) {
    total.classList.toggle('is-warn', totalPct >= STORAGE_WARN_RATIO * 100);
    const warnLine = total.querySelector('.strip__warn');
    if (warnLine) warnLine.style.setProperty('--w', STORAGE_WARN_RATIO * 100 + '%');
  }

  const aiRows = [
    ['analyses', 'Reference analyses today', ai.analyses],
    ['questions', 'Nyxi questions today', ai.questions],
  ];
  for (const row of aiRows) {
    const count = row[2];
    fillStrip(row[0], percent(count.used, count.limit), String(count.used), '/' + count.limit,
      row[1] + ' ' + count.used + ' of ' + count.limit);
  }

  const summary = document.getElementById('usage-storage');
  if (summary) summary.textContent = toGb(storage.used_bytes) + ' / ' + quotaGb + ' GB';

  // 오늘 UTC 0시를 만들어 이 컴퓨터의 시계로 읽음 (30분 단위 시간대도 맞음)
  const reset = document.getElementById('usage-reset');
  if (reset) {
    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const pad = (n) => (n < 10 ? '0' : '') + n;
    reset.textContent = pad(utcMidnight.getHours()) + ':' + pad(utcMidnight.getMinutes());
  }
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
 * - 서버 시각은 UTC 인데 시간대 표시가 없어서 끝에 Z 를 붙여 읽음 → 날짜 · 시각은 이 컴퓨터의 시간대로
 * - 7일 칸 안에 들어간 세션만 막대와 합계에 셈 (막대와 합계가 어긋나지 않게)
 * - 글자는 모두 textContent 로 넣음 (프로젝트 제목에 태그가 있어도 글자 그대로)
 * (구현: AI — 2026-10-12, 함수 하나씩 검토)
 * @param {Array<object>} projects  대시보드의 recent_projects
 */
export function renderRecentProjects(projects) {
  const list = document.getElementById('recent-list');
  const ruler = document.getElementById('recent-days');
  const empty = document.getElementById('recent-empty');
  const weekTotal = document.getElementById('recent-week-total');

  // 서버 시각(UTC, 시간대 표시 없음) → Date
  const toDate = (value) => {
    const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(value);
    return new Date(hasZone ? value : value + 'Z');
  };
  const two = (n) => (n < 10 ? '0' : '') + n;
  const hhmm = (date) => two(date.getHours()) + ':' + two(date.getMinutes());
  const dayKey = (date) => date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();

  // 오늘 포함 지난 7일 (오래된 날이 왼쪽)
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      key: dayKey(date),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: date.getDate(),
      isToday: i === 0,
    });
  }

  // '9 hours' · '4 hours 45 minutes' · '30 minutes' (화면 읽기용 — 분 단위로 반올림)
  const describe = (seconds) => {
    const total = seconds > 0 ? Math.round(seconds / 60) : 0;
    const h = Math.floor(total / 60);
    const m = total % 60;
    const parts = [];
    if (h > 0) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m > 0 || h === 0) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
    return parts.join(' ');
  };

  // 요일 눈금
  if (ruler) {
    ruler.textContent = '';
    for (const day of days) {
      const cell = document.createElement('span');
      if (day.isToday) cell.className = 'is-today';
      const small = document.createElement('small');
      small.textContent = day.dayNumber;
      cell.appendChild(document.createTextNode((day.isToday ? 'Today' : day.weekday) + ' '));
      cell.appendChild(small);
      ruler.appendChild(cell);
    }
    const week = document.createElement('span');
    week.className = 'lanes__sum';
    week.textContent = 'Week';
    ruler.appendChild(week);
  }

  // 프로젝트 줄
  let grandTotal = 0;
  if (list) list.textContent = '';
  for (const project of projects) {
    const cells = [];
    for (let d = 0; d < days.length; d++) {
      const cell = document.createElement('span');
      cell.className = 'lane__day' + (days[d].isToday ? ' is-today' : '');
      cells.push(cell);
    }

    const sessions = project.sessions.slice().sort((a, b) => toDate(a.started_at) - toDate(b.started_at));
    let projectTotal = 0;
    for (const session of sessions) {
      const start = toDate(session.started_at);
      let index = -1;
      for (let d = 0; d < days.length; d++) {
        if (days[d].key === dayKey(start)) index = d;
      }
      if (index < 0) continue; // 7일 칸 밖 (시간대 때문에 가장자리에서 밀린 세션)

      const end = toDate(session.last_seen_at);
      const endText = dayKey(end) === dayKey(start) ? hhmm(end) : '24:00'; // 자정을 넘기면 그날 끝(24:00)까지만 표시
      const label = days[index].isToday ? 'Today' : days[index].weekday + ' ' + days[index].dayNumber;
      const percent = Math.round(Math.min(100, (session.active_seconds / DAY_FULL_SECONDS) * 100) * 10) / 10;

      const bar = document.createElement('i');
      bar.style.setProperty('--w', percent + '%');
      bar.title = label + ' · ' + hhmm(start) + '–' + endText + ' · ' + formatDuration(session.active_seconds);
      cells[index].appendChild(bar);
      projectTotal += session.active_seconds;
    }
    grandTotal += projectTotal;

    const meta = [Number(project.bpm) + ' BPM'];
    if (project.music_key) meta.push(project.music_key);
    meta.push(formatRelativeTime(project.updated_at));

    const head = document.createElement('a');
    head.className = 'lane__head';
    head.href = 'studioNx.html?projectId=' + encodeURIComponent(project.project_id);
    const title = document.createElement('b');
    title.textContent = project.title;
    const sub = document.createElement('span');
    sub.textContent = meta.join(' · ');
    head.appendChild(title);
    head.appendChild(sub);

    const daysBox = document.createElement('span');
    daysBox.className = 'lane__days';
    daysBox.setAttribute('role', 'img');
    daysBox.setAttribute('aria-label', project.title + ': ' + describe(projectTotal) + ' in the last 7 days');
    for (const cell of cells) daysBox.appendChild(cell);

    const sum = document.createElement('b');
    sum.className = 'lane__sum';
    sum.textContent = formatDuration(projectTotal);

    const lane = document.createElement('li');
    lane.className = 'lane';
    lane.appendChild(head);
    lane.appendChild(daysBox);
    lane.appendChild(sum);
    if (list) list.appendChild(lane);
  }

  if (weekTotal) weekTotal.textContent = formatDuration(grandTotal);

  // 프로젝트가 없으면 안내 문장만
  const hasProjects = projects.length > 0;
  if (list) list.hidden = !hasProjects;
  if (ruler) ruler.hidden = !hasProjects;
  if (empty) empty.hidden = hasProjects;
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
 * - 배너 안의 'Open in studio' 도 다른 링크처럼 새 창으로 열도록, 배너에 data-title(프로젝트 제목)을 넣어 둠
 *   → 페이지 시작 코드에서 initDesktopOnlyLinks(#ready-banner) 를 걸면 안내 모달 제목이 맞음 (JS 38)
 * - × 로 닫은 ID 목록에서 지금 이어 하기 목록에 없는 ID(그사이 열었거나 지운 프로젝트)는 지워 목록이 계속 커지지 않게 함
 * - '다시 호출'해도 × 처리기가 쌓이지 않게 onclick 하나만 씀
 * (구현: AI — 2026-10-12, 함수 하나씩 검토)
 * @param {Array<object>} projects  대시보드의 ready_projects (최근 생성순)
 */
export function renderReadyBanner(projects) {
  const KEY = 'studionx.readyDismissed';
  const banner = document.getElementById('ready-banner');
  if (!banner) return;

  // 이 브라우저에서 닫은 프로젝트 번호들 (localStorage 가 막혀 있으면 빈 목록)
  let dismissed = [];
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) dismissed = saved;
  } catch (err) {
    dismissed = [];
  }

  // 지금 이어 하기 목록에 없는 번호는 버림
  const stillReady = [];
  for (const id of dismissed) {
    for (const project of projects) {
      if (project.project_id === id) stillReady.push(id);
    }
  }
  if (stillReady.length !== dismissed.length) {
    dismissed = stillReady;
    try {
      localStorage.setItem(KEY, JSON.stringify(dismissed));
    } catch (err) {
      // 저장하지 못해도 화면에는 영향 없음
    }
  }

  const candidates = [];
  for (const project of projects) {
    if (dismissed.indexOf(project.project_id) < 0) candidates.push(project);
  }
  if (candidates.length === 0) {
    banner.hidden = true;
    return;
  }

  const project = candidates[0];
  const title = document.getElementById('ready-title');
  const open = document.getElementById('ready-open');
  const meta = banner.querySelector('.ready__meta');
  const more = document.getElementById('ready-more');
  const close = document.getElementById('ready-close');

  banner.dataset.title = project.title;
  if (title) title.textContent = project.title;
  if (open) open.href = 'studioNx.html?projectId=' + encodeURIComponent(project.project_id);

  if (meta) {
    let created = formatRelativeTime(project.created_at);
    if (created === 'Just now' || created === 'Yesterday') created = created.toLowerCase();
    const text = 'Not opened yet · created ' + created + ' · ' + Number(project.bpm) + ' BPM · '
      + project.time_sig_num + '/' + project.time_sig_den;

    meta.textContent = '';
    meta.appendChild(document.createTextNode(text));
    if (more) {
      more.textContent = '';
      const rest = candidates.length - 1;
      more.hidden = rest === 0;
      if (rest > 0) {
        // 링크는 매번 새로 만듦 (앞서 칸을 비우면 링크도 사라지므로 기존 것을 다시 쓰지 않음)
        const link = document.createElement('a');
        link.className = 'text-link text-link--strong';
        link.href = 'myProject.html';
        link.textContent = 'My Projects';
        more.appendChild(document.createTextNode(' · ' + rest + ' more in '));
        more.appendChild(link);
      }
      meta.appendChild(more);
    }
  }

  if (close) {
    close.onclick = function () {
      dismissed.push(project.project_id);
      try {
        localStorage.setItem(KEY, JSON.stringify(dismissed));
      } catch (err) {
        // 저장하지 못해도 이번 접속에서는 닫힘
      }
      banner.hidden = true;
    };
  }
  banner.hidden = false;
}

/**
 * 초 → '9h 00m'
 * - 분 단위로 **반올림**한 뒤 시간과 분으로 나눔 (3590초 = 59.8분 → '1h 00m', 29초 → '0h 00m', 30초 → '0h 01m')
 * - 분은 두 자리 (5분 → '0h 05m'), 시간은 자릿수 제한 없음 (100시간 → '100h 00m')
 * - 음수 · 숫자가 아닌 값은 0 으로 봄 ('0h 00m')
 * (구현: AI — 2026-10-12, 함수 하나씩 검토)
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const total = seconds > 0 ? Math.round(seconds / 60) : 0;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours + 'h ' + (minutes < 10 ? '0' : '') + minutes + 'm';
}

// 로그아웃 버튼(27)은 세 화면 공통이라 core/auth-ui.js initLogoutButton 을 import 해서 씀 (아래 맨 끝 줄)

// 공통 헤더·푸터를 먼저 끼움 (static/partials/) — 아래 init 들은 그 요소를 찾으므로 순서 중요
await includePartials();

initAuthState();
// 작은 화면에서 '시퀀서 열기' 링크를 누르면 안내 (FR-129) — 목록이 다시 그려져도 되도록 상자에 한 번만 걸어 둠
initDesktopOnlyLinks(document.getElementById('recent-list'));
initDesktopOnlyLinks(document.getElementById('ready-banner'));
initLogoutButton();   // 대시보드를 기다리는 동안에도 누를 수 있게 먼저 연결
// 로그인 안 했으면 home.html#login?next=/myPage.html 로 (core/auth.js) — 했으면 대시보드를 받아 네 곳을 채움
if (await requireLogin()) {
  const data = await loadDashboard();
  if (data) {
    renderReadyBanner(data.ready_projects);
    renderProfile(data.user);
    renderUsage(data.storage, data.ai);
    renderRecentProjects(data.recent_projects);
  }
}
