// 시간 글자 공통 함수 (P1-17 에서 만듦)
// myproject.js 의 formatRelativeTime(P1-14 29)과 같은 코드를 공통으로 뺀 것.
// myproject.js 를 불러오면 그 페이지의 시작 코드까지 실행되므로, 마이페이지는 여기서 가져다 씀.
// (myproject.js 는 이미 검토와 시험이 끝난 코드라 그대로 두었음 — 2026-10-12 결정)

/**
 * '12 minutes ago' · '2 hours ago' · 'Yesterday' · '3 days ago' · 'Sep 27' (7일 넘으면 날짜)
 * - 서버 시각은 UTC 인데 시간대 표시가 없음 ('2026-10-08T02:10:11.123000') → 'Z' 를 붙여 UTC 로 읽음
 * - 'Yesterday' 와 날짜는 이 컴퓨터의 시간대(달력) 기준, 다른 해면 'Sep 27, 2025'
 * - 1분 안 · 미래 시각(컴퓨터 시계가 조금 느릴 때)은 'Just now'
 * (구현: AI — 2026-10-08, 함수 하나씩 검토)
 * @param {string} isoTime  updated_at (UTC)
 * @param {Date} [now]  지금 시각 — 시험할 때만 넘김
 * @returns {string}
 */
export function formatRelativeTime(isoTime, now = new Date()) {
  const hasZone = /[zZ]$|[+-]\d\d:\d\d$/.test(isoTime);
  const time = new Date(hasZone ? isoTime : isoTime + 'Z');
  const minutes = Math.floor((now - time) / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : minutes + ' minutes ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : hours + ' hours ago';

  // 달력으로 며칠 전인지 — 두 날의 자정끼리 비교 (시각은 버림)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(time.getFullYear(), time.getMonth(), time.getDate());
  const days = Math.round((today - day) / 86400000);   // round: 서머타임으로 하루가 23·25시간인 날 대비
  if (days <= 1) return 'Yesterday';
  if (days <= 7) return days + ' days ago';

  const options = { month: 'short', day: 'numeric' };
  if (time.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return time.toLocaleDateString('en-US', options);
}
