// 프론트엔드 Sentry 초기화 (템플릿)
// 각 HTML 페이지 <head>에 Sentry CDN 번들 스크립트를 먼저 넣고, 그 다음에 이 파일을 불러온다.
//   <script src="https://browser.sentry-cdn.com/<버전>/bundle.tracing.min.js" crossorigin="anonymous"></script>
//   <script src="/static/js/core/sentry-init.js"></script>
// 브라우저용 DSN은 공개되어도 되는 값이지만, 비밀번호·토큰은 절대 이벤트에 넣지 않는다 (PRD 00 §7).

/**
 * @param {{ dsn: string, environment: string, release?: string }} options
 */
export function initSentry(options) {
  // TODO: options.dsn 이 비어 있으면 아무것도 하지 않기
  // TODO: Sentry.init({ dsn, environment, release, tracesSampleRate, beforeSend })
  // TODO: beforeSend 에서 입력값·토큰 등 민감정보 제거
}

/**
 * 오디오 엔진 품질 지표 전송 (PRD 00 §7 "모니터링 지표")
 * @param {string} name   예: 'audio.underrun', 'project.load_ms'
 * @param {number} value
 */
export function reportMetric(name, value) {
  // TODO: Sentry 커스텀 이벤트/측정값으로 전송
}
