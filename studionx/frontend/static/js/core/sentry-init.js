// 프런트엔드 오류 수집 (S1-13, PRD 00 §7) — 화면에서 난 JS 오류를 Sentry 로 보냅니다.
// 설명: docs/ai-notes/javascript/S1-13 - Sentry 화면 오류 수집/
//
// Sentry 의 브라우저 스크립트(SDK)를 싣지 않고, Sentry 가 받는 envelope 주소로 직접 보냅니다.
// 이유: 외부 스크립트를 싣지 않으면 (1) 보내는 내용을 이 파일에서 모두 통제할 수 있고
//       (2) 스크립트의 버전과 무결성 해시를 따로 관리하지 않아도 되며 (3) 화면을 여는 속도에 영향이 없습니다.
// 대신 SDK 가 해 주는 일(이동 경로 기록, 소스맵, 성능 측정)은 하지 않습니다.
//
// 동작
// - 이 파일을 불러오면 오류 처리기(error, unhandledrejection)가 바로 설치됩니다.
//   그래서 각 페이지 진입 파일의 "첫 import" 로 둡니다 (다른 파일이 불러오다 난 오류도 잡으려고).
// - 오류가 처음 났을 때만 GET /api/v1/client-config 로 DSN 을 받습니다. DSN 이 비어 있으면 아무것도 보내지 않습니다.
// - 보내기 전에 주소의 query · hash 와 글 속의 이메일 · 토큰을 지웁니다.
//   쿠키와 인증 헤더는 실리지 않습니다 (credentials: 'omit'). Referer 도 보내지 않습니다.
// - 같은 오류는 한 번만, 한 화면에서 최대 MAX_EVENTS 건까지만 보냅니다 (반복되는 오류가 쌓이지 않게).
// - 이 파일의 어떤 오류도 화면으로 새지 않습니다 (오류를 보고하다 난 오류는 조용히 버림).

// 다른 파일을 불러오지 않습니다: 이 파일이 가장 먼저 실행되어 처리기를 설치해야 하고, api.js 같은 파일이 불러오다 실패해도 잡아야 하기 때문입니다.

/** 화면 설정을 받는 주소 (core/api.js 의 API_BASE 와 같은 값) */
const CONFIG_URL = '/api/v1/client-config';
/** 한 화면(페이지 로드)에서 보낼 수 있는 최대 건수 */
export const MAX_EVENTS = 10;
/** 오류 문구 최대 길이 */
const MAX_MESSAGE = 500;
const SDK = { name: 'studionx.browser', version: '1.0.0' };

/* ───────────────────────── 순수 함수 (DOM 없이 시험) ───────────────────────── */

/**
 * DSN 문자열 읽기 — https://<키>@<호스트>[/<경로>]/<프로젝트번호>
 * @param {string} dsn
 * @returns {{key:string, host:string, projectId:string, url:string}|null}  url 은 envelope 을 보낼 주소. 모양이 틀리면 null
 */
export function parseDsn(dsn) {
  if (typeof dsn !== 'string') return null;
  const m = /^(https?):\/\/([^:@\/]+)(?::[^@\/]*)?@([^\/]+)((?:\/[^\/]+)*)\/(\d+)\/?$/.exec(dsn.trim());
  if (!m) return null;
  return {
    key: m[2],
    host: m[3],
    projectId: m[5],
    url: m[1] + '://' + m[3] + m[4] + '/api/' + m[5] + '/envelope/?sentry_key=' + encodeURIComponent(m[2]) + '&sentry_version=7',
  };
}

/** 주소에서 ? 뒤(query)와 # 뒤(hash)를 지움 — 재설정 토큰 같은 값이 주소에 실려 있을 수 있음 */
export function scrubUrl(url) {
  if (typeof url !== 'string') return '';
  const cut = url.search(/[?#]/);
  return cut >= 0 ? url.slice(0, cut) : url;
}

/**
 * 글 속의 민감한 값 지우기 — 이메일, 토큰, 비밀번호, JWT, Bearer, 주소의 query
 * @param {*} text
 * @returns {string}
 */
export function scrubText(text) {
  let s = String(text == null ? '' : text);
  s = s.replace(/(https?:\/\/[^\s?#]+)[?#]\S*/g, '$1');
  s = s.replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[jwt]');
  s = s.replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer [Filtered]');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
  s = s.replace(/\b(token|password|passwd|secret|api[_-]?key|authorization|cookie|snx_refresh)(["']?\s*[=:]\s*["']?)[^\s"'&,;]+/gi, '$1$2[Filtered]');
  return s;
}

/**
 * 스택 글자를 Sentry 의 frames 로 — Chrome, Edge ("at 함수 (주소:줄:칸)")와 Firefox, Safari ("함수@주소:줄:칸")
 * Sentry 는 오래된 호출부터 받으므로 뒤집어서 돌려줌 (마지막 항목이 오류가 난 자리)
 * @param {string} stack
 * @returns {Array<{function:string, filename:string, lineno:number, colno:number, in_app:boolean}>}
 */
export function parseStack(stack) {
  const frames = [];
  if (typeof stack !== 'string') return frames;
  stack.split('\n').forEach(function (line) {
    let m = /^\s*at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!m) m = /^\s*(.*?)@(.*?):(\d+):(\d+)\s*$/.exec(line);
    if (!m) return;
    frames.push({
      function: m[1] || '?',
      filename: scrubUrl(m[2]),
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: m[2].indexOf('/static/js/') >= 0,
    });
  });
  return frames.reverse();
}

/**
 * 던져진 값(Error, 문자열, 아무 값)을 { name, message, stack } 로 정리
 * @param {*} value
 */
export function normalizeError(value) {
  if (value && typeof value === 'object' && (typeof value.message === 'string' || typeof value.stack === 'string')) {
    return { name: String(value.name || 'Error'), message: String(value.message || ''), stack: typeof value.stack === 'string' ? value.stack : '' };
  }
  if (typeof value === 'string') return { name: 'Error', message: value, stack: '' };
  let text = '';
  try { text = JSON.stringify(value); } catch (e) { text = String(value); }
  return { name: 'UnhandledRejection', message: 'Non-Error value: ' + text, stack: '' };
}

/** 32자리 16진수 이벤트 번호 */
function newEventId() {
  let out = '';
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i += 1) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }
  for (let j = 0; j < 32; j += 1) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

/** 주소에서 경로만 (예: https://x/studioNx.html?a=1 → /studioNx.html) */
function pathOf(url) {
  const clean = scrubUrl(url);
  const m = /^https?:\/\/[^\/]+(\/.*)?$/.exec(clean);
  return m ? (m[1] || '/') : clean;
}

/**
 * Sentry 이벤트 만들기 — 보내는 값은 모두 여기서 정해지고, 주소와 글은 지운 뒤에 담김
 * @param {object} e  { name, message, stack } (normalizeError 결과) 또는 { message } (지표)
 * @param {{environment?:string, release?:string, url?:string, userAgent?:string, mechanism?:string, level?:string, extra?:object, isMessage?:boolean}} ctx
 */
export function buildEvent(e, ctx) {
  const frames = parseStack(e.stack);
  const event = {
    event_id: newEventId(),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: ctx.level || 'error',
    environment: ctx.environment || 'dev',
    sdk: SDK,
    request: { url: scrubUrl(ctx.url), headers: { 'User-Agent': ctx.userAgent || '' } },
    tags: { page: pathOf(ctx.url) },
  };
  if (ctx.release) event.release = ctx.release;
  if (ctx.extra) event.extra = ctx.extra;
  const text = scrubText(e.message).slice(0, MAX_MESSAGE);
  if (ctx.isMessage) {
    event.message = text;
  } else {
    const value = { type: String(e.name || 'Error'), value: text, mechanism: { type: ctx.mechanism || 'generic', handled: false } };
    if (frames.length) value.stacktrace = { frames: frames };
    event.exception = { values: [value] };
  }
  return event;
}

/** envelope 본문 — 줄바꿈으로 나뉜 세 덩어리(머리, 항목 머리, 이벤트) */
export function buildEnvelope(event) {
  return JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() })
    + '\n' + JSON.stringify({ type: 'event' })
    + '\n' + JSON.stringify(event);
}

/** 같은 오류인지 알아보는 열쇠 — 종류, 문구, 오류가 난 자리 */
function fingerprintOf(e) {
  const frames = parseStack(e.stack);
  const top = frames.length ? frames[frames.length - 1] : null;
  return e.name + '|' + scrubText(e.message) + '|' + (top ? top.filename + ':' + top.lineno + ':' + top.colno : '');
}

/**
 * 보낼 오류인지 판단 (순수 함수) — 상태(보낸 수, 본 오류)는 호출한 쪽이 가짐
 * 보내지 않는 것: 서버가 일부러 준 오류(ApiError, 로그인 풀림 등), 브라우저의 무해한 알림(ResizeObserver),
 *                 내용 없는 "Script error."(다른 출처 스크립트), 확장 프로그램이 낸 오류, 이미 본 오류, 한도 초과
 * @param {{name:string, message:string, stack:string}} e
 * @param {{count:number, seen:Object<string,boolean>}} state
 * @returns {{send:boolean, reason:string}}
 */
export function judgeReport(e, state) {
  if (e.name === 'ApiError') return { send: false, reason: 'api-error' };
  if (/ResizeObserver loop/i.test(e.message)) return { send: false, reason: 'noise' };
  if (e.message === 'Script error.' || e.message === 'Script error') return { send: false, reason: 'cross-origin' };
  if (/(chrome|moz|safari)-extension:\/\//.test(e.stack)) return { send: false, reason: 'extension' };
  if (state.count >= MAX_EVENTS) return { send: false, reason: 'limit' };
  if (state.seen[fingerprintOf(e)]) return { send: false, reason: 'duplicate' };
  return { send: true, reason: 'ok' };
}

/* ───────────────────────── 보내기 ───────────────────────── */

/** 이번 화면에서 보낸 건수와 본 오류 */
const state = { count: 0, seen: {} };
/** initSentry 로 정해 준 설정 (있으면 서버에 묻지 않음) */
let manualConfig = null;
/** 서버에서 받은 설정 (한 번만 물음) */
let configPromise = null;
let transport = defaultTransport;
let metricsSent = {};

/** 기본 전송 — 쿠키 없이, Referer 없이 */
function defaultTransport(url, body) {
  return fetch(url, {
    method: 'POST',
    body: body,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },   // 단순 요청이라 사전 확인(preflight) 없이 감
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  });
}

/** 시험용: 전송 함수 바꿔 끼우기 (undefined 면 기본으로) */
export function setTransport(fn) {
  transport = typeof fn === 'function' ? fn : defaultTransport;
}

/** 시험용: 보낸 건수와 설정을 처음 상태로 */
export function resetSentry() {
  state.count = 0;
  state.seen = {};
  manualConfig = null;
  configPromise = null;
  metricsSent = {};
  transport = defaultTransport;
}

/** 설정 얻기 — initSentry 로 정한 값이 있으면 그것, 없으면 서버(GET /client-config)에서 한 번 */
function getConfig() {
  if (manualConfig) return Promise.resolve(manualConfig);
  if (!configPromise) {
    configPromise = fetch(CONFIG_URL, { credentials: 'omit' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (c) {
        return c && c.sentry_dsn ? { dsn: c.sentry_dsn, environment: c.environment, release: c.release } : null;
      })
      .catch(function () { configPromise = null; return null; });   // 서버에 닿지 못했으면 다음 오류 때 다시 묻기
  }
  return configPromise;
}

/** 이벤트를 만들어 보내기 (공통) */
function send(e, ctxExtra) {
  return getConfig().then(function (config) {
    const dsn = config ? parseDsn(config.dsn) : null;
    if (!dsn) return { sent: false, reason: 'no-dsn' };
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const loc = typeof location !== 'undefined' ? location : null;
    const event = buildEvent(e, Object.assign({
      environment: config.environment,
      release: config.release,
      url: loc ? loc.origin + loc.pathname : '',
      userAgent: nav ? nav.userAgent : '',
    }, ctxExtra));
    return Promise.resolve(transport(dsn.url, buildEnvelope(event))).then(
      function () { return { sent: true, reason: 'ok', eventId: event.event_id }; },
      function () { return { sent: false, reason: 'send-failed' }; },
    );
  });
}

/**
 * 오류 하나 보내기 — 처리기가 부르고, 직접 불러도 됩니다. 어떤 경우에도 오류를 던지지 않습니다.
 * @param {*} error       던져진 값
 * @param {string} [mechanism]  'onerror' | 'onunhandledrejection' | 'manual'
 * @returns {Promise<{sent:boolean, reason:string, eventId?:string}>}
 */
export function captureException(error, mechanism) {
  try {
    const e = normalizeError(error);
    const verdict = judgeReport(e, state);
    if (!verdict.send) return Promise.resolve({ sent: false, reason: verdict.reason });
    state.count += 1;
    state.seen[fingerprintOf(e)] = true;
    return send(e, { mechanism: mechanism || 'manual' }).catch(function () { return { sent: false, reason: 'error' }; });
  } catch (err) {
    return Promise.resolve({ sent: false, reason: 'error' });
  }
}

/**
 * 오류 처리기 설치 — 한 화면에 한 번만
 * - error: 잡히지 않은 오류 (스크립트 불러오기 실패처럼 오류 객체가 없는 것은 건너뜀)
 * - unhandledrejection: 처리하지 않은 Promise 거절
 * @param {Window} [target]
 * @returns {boolean} 새로 설치했으면 true
 */
export function installHandlers(target) {
  const w = target || (typeof window !== 'undefined' ? window : null);
  if (!w || w.__snxErrorHandlers) return false;
  w.__snxErrorHandlers = true;
  w.addEventListener('error', function (ev) {
    if (!ev.error && !ev.message) return;
    captureException(ev.error || ev.message, 'onerror');
  });
  w.addEventListener('unhandledrejection', function (ev) {
    captureException(ev.reason, 'onunhandledrejection');
  });
  return true;
}

/**
 * 설정을 직접 정하고 처리기를 설치 — 보통은 부르지 않아도 됩니다 (서버의 설정을 씀). 시험이나 특별한 화면용.
 * @param {{ dsn: string, environment?: string, release?: string }} options
 * @returns {boolean} DSN 이 올바르면 true
 */
export function initSentry(options) {
  installHandlers();
  if (!options || !parseDsn(options.dsn)) return false;
  manualConfig = { dsn: options.dsn, environment: options.environment || 'dev', release: options.release || '' };
  return true;
}

/**
 * 품질 지표 하나 보내기 (PRD 00 §7 "모니터링 지표") — 오류가 아닌 정보 이벤트, 이름마다 한 화면에 한 번만
 * @param {string} name   예: 'audio.underrun', 'project.load_ms'
 * @param {number} value
 * @returns {Promise<{sent:boolean, reason:string}>}
 */
export function reportMetric(name, value) {
  try {
    const clean = String(name == null ? '' : name).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60);
    const n = Number(value);
    if (!clean || !isFinite(n)) return Promise.resolve({ sent: false, reason: 'invalid' });
    if (metricsSent[clean] || state.count >= MAX_EVENTS) return Promise.resolve({ sent: false, reason: 'limit' });
    metricsSent[clean] = true;
    state.count += 1;
    return send({ message: 'metric ' + clean }, { level: 'info', isMessage: true, extra: { value: n } })
      .catch(function () { return { sent: false, reason: 'error' }; });
  } catch (err) {
    return Promise.resolve({ sent: false, reason: 'error' });
  }
}

// 불러오는 즉시 처리기를 설치 (화면이 아닌 곳(Node 시험)에서는 window 가 없어 아무 일도 하지 않음)
installHandlers();
