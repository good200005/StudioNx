// S1-13 화면 오류 수집 순수 함수 시험 — DSN 읽기, 주소와 글 지우기, 스택 읽기, 이벤트 만들기, 보낼지 판단 (브라우저 불필요)
// 실행: node docs/handoff/s1-13_tests/sentry_unit.mjs
import fs from 'node:fs';
import path from 'node:path';
import {
  parseDsn, scrubUrl, scrubText, parseStack, normalizeError, buildEvent, buildEnvelope, judgeReport,
  captureException, reportMetric, initSentry, setTransport, resetSentry, installHandlers, MAX_EVENTS,
} from '../../../studionx/frontend/static/js/core/sentry-init.js';

let ok = 0, bad = 0;
const t = (n, c, d) => { if (c) ok++; else { bad++; console.log('FAIL', n, d === undefined ? '' : d); } };

// ── parseDsn
const d1 = parseDsn('https://abc123@o1.ingest.sentry.io/456');
t('DSN: 키, 호스트, 프로젝트 번호', d1 && d1.key === 'abc123' && d1.host === 'o1.ingest.sentry.io' && d1.projectId === '456', JSON.stringify(d1));
t('DSN: envelope 주소', d1 && d1.url === 'https://o1.ingest.sentry.io/api/456/envelope/?sentry_key=abc123&sentry_version=7', d1 && d1.url);
const d2 = parseDsn('http://k@127.0.0.1:9000/7');
t('DSN: 포트가 있는 로컬 주소', d2 && d2.url === 'http://127.0.0.1:9000/api/7/envelope/?sentry_key=k&sentry_version=7', d2 && d2.url);
const d3 = parseDsn('https://pub@sentry.example.com/prefix/9');
t('DSN: 경로 접두어가 있는 주소', d3 && d3.url === 'https://sentry.example.com/prefix/api/9/envelope/?sentry_key=pub&sentry_version=7', d3 && d3.url);
const d4 = parseDsn('https://pub:old-secret@o1.ingest.sentry.io/5');
t('DSN: 예전 형식의 비밀 부분은 버림', d4 && d4.url.indexOf('old-secret') < 0 && d4.key === 'pub', d4 && d4.url);
['', null, undefined, 42, 'not a dsn', 'https://o1.ingest.sentry.io/456', 'https://k@host/abc', 'ftp://k@host/1'].forEach(function (bad1) {
  t('DSN: 잘못된 값은 null (' + String(bad1) + ')', parseDsn(bad1) === null);
});

// ── scrubUrl
t('주소: query 를 지움', scrubUrl('https://x/resetPassword.html?token=SECRET') === 'https://x/resetPassword.html');
t('주소: hash 를 지움', scrubUrl('https://x/a.html#access_token=SECRET') === 'https://x/a.html');
t('주소: query 와 hash 둘 다', scrubUrl('https://x/a.js?v=1#frag') === 'https://x/a.js');
t('주소: 없으면 그대로', scrubUrl('https://x/a.js') === 'https://x/a.js');
t('주소: 문자열이 아니면 빈 글', scrubUrl(undefined) === '' && scrubUrl(5) === '');

// ── scrubText
const sx = scrubText('Failed for user@example.com with token=abc123XYZ and password: hunter2');
t('글: 이메일을 지움', sx.indexOf('user@example.com') < 0 && sx.indexOf('[email]') >= 0, sx);
t('글: token= 값을 지움', sx.indexOf('abc123XYZ') < 0 && sx.indexOf('token=[Filtered]') >= 0, sx);
t('글: password: 값을 지움', sx.indexOf('hunter2') < 0, sx);
t('글: Bearer 토큰을 지움', scrubText('Authorization: Bearer abc.def-ghi_123=').indexOf('abc.def') < 0);
t('글: JWT 를 지움', scrubText('bad eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdef end').indexOf('eyJhbGci') < 0);
t('글: 주소 안의 query 를 지움', scrubText('fetch https://x/api?email=a&token=zzz failed') === 'fetch https://x/api failed', scrubText('fetch https://x/api?email=a&token=zzz failed'));
t('글: 쿠키 이름 값을 지움', scrubText('snx_refresh=abcdef12345').indexOf('abcdef12345') < 0);
t('글: 일반 문장은 그대로', scrubText('Cannot read properties of null (reading "x")') === 'Cannot read properties of null (reading "x")');
t('글: null 과 undefined 는 빈 글', scrubText(null) === '' && scrubText(undefined) === '');

// ── parseStack
const chromeStack = [
  'TypeError: x is not a function',
  '    at doThing (http://localhost:8000/static/js/pages/home.js?v=3:10:5)',
  '    at http://localhost:8000/static/js/core/api.js:20:7',
  '    at async Object.run (http://localhost:8000/static/js/core/auth.js:5:3)',
].join('\n');
const fr = parseStack(chromeStack);
t('스택(Chrome): 세 줄을 읽음', fr.length === 3, JSON.stringify(fr));
t('스택: 오래된 호출부터 (마지막이 오류 난 자리)', fr[2].function === 'doThing' && fr[2].lineno === 10 && fr[2].colno === 5, JSON.stringify(fr[2]));
t('스택: 파일 주소의 query 를 지움', fr[2].filename === 'http://localhost:8000/static/js/pages/home.js', fr[2].filename);
t('스택: 함수 이름이 없는 줄은 ?', fr[1].function === '?', JSON.stringify(fr[1]));
t('스택: async 이름', fr[0].function === 'async Object.run');
t('스택: static/js 안이면 in_app', fr[2].in_app === true);
const ff = parseStack('doThing@http://localhost:8000/static/js/a.js:3:9\n@http://localhost:8000/static/js/b.js:4:1');
t('스택(Firefox): 함수@주소:줄:칸', ff.length === 2 && ff[1].function === 'doThing' && ff[1].lineno === 3, JSON.stringify(ff));
t('스택: 없거나 이상한 값은 빈 목록', parseStack('').length === 0 && parseStack(undefined).length === 0 && parseStack('Error: x').length === 0);

// ── normalizeError
const ne = normalizeError(new RangeError('too big'));
t('정리: Error 의 종류와 문구', ne.name === 'RangeError' && ne.message === 'too big' && ne.stack.length > 0);
t('정리: 문자열', JSON.stringify(normalizeError('boom')) === JSON.stringify({ name: 'Error', message: 'boom', stack: '' }));
t('정리: 객체(Error 아님)는 UnhandledRejection', normalizeError({ a: 1 }).name === 'UnhandledRejection' && normalizeError({ a: 1 }).message.indexOf('{"a":1}') > 0);
t('정리: undefined 도 던지지 않음', normalizeError(undefined).name === 'UnhandledRejection');
const circ = {}; circ.self = circ;
t('정리: 순환 객체도 던지지 않음', normalizeError(circ).name === 'UnhandledRejection');

// ── buildEvent / buildEnvelope
const err = new Error('Could not load user@example.com ?token=S3CR3T');
const ev = buildEvent(normalizeError(err), { environment: 'prod', release: 'studionx@0.1.0', url: 'https://app.example.com/resetPassword.html?token=URLSECRET#h', userAgent: 'UA/1', mechanism: 'onerror' });
const evJson = JSON.stringify(ev);
t('이벤트: 번호는 32자리 16진수', /^[0-9a-f]{32}$/.test(ev.event_id), ev.event_id);
t('이벤트: 기본 항목', ev.platform === 'javascript' && ev.level === 'error' && ev.environment === 'prod' && ev.release === 'studionx@0.1.0' && ev.sdk.name === 'studionx.browser');
t('이벤트: 오류 종류와 mechanism', ev.exception.values[0].type === 'Error' && ev.exception.values[0].mechanism.type === 'onerror' && ev.exception.values[0].mechanism.handled === false);
t('이벤트: 주소에서 query 와 hash 가 빠짐', ev.request.url === 'https://app.example.com/resetPassword.html' && evJson.indexOf('URLSECRET') < 0, ev.request.url);
t('이벤트: 문구에서 이메일과 토큰이 빠짐', evJson.indexOf('user@example.com') < 0 && evJson.indexOf('S3CR3T') < 0, evJson.slice(0, 300));
t('이벤트: 태그의 page 는 경로만', ev.tags.page === '/resetPassword.html', ev.tags.page);
t('이벤트: User-Agent 만 헤더에 (쿠키와 인증 헤더 없음)', Object.keys(ev.request.headers).join() === 'User-Agent');
t('이벤트: 스택이 frames 로 들어감', ev.exception.values[0].stacktrace && ev.exception.values[0].stacktrace.frames.length > 0);
t('이벤트: 시각은 초 단위 숫자', typeof ev.timestamp === 'number' && Math.abs(ev.timestamp - Date.now() / 1000) < 5);
const longMsg = buildEvent({ name: 'Error', message: 'x'.repeat(2000), stack: '' }, { url: 'https://a/b' });
t('이벤트: 문구는 500자까지', longMsg.exception.values[0].value.length === 500);
const msgEv = buildEvent({ message: 'metric audio.underrun' }, { url: 'https://a/b', level: 'info', isMessage: true, extra: { value: 3 } });
t('이벤트(지표): message 와 level info, exception 없음', msgEv.message === 'metric audio.underrun' && msgEv.level === 'info' && !msgEv.exception && msgEv.extra.value === 3);
const env = buildEnvelope(ev).split('\n');
t('envelope: 세 덩어리(머리, 항목 머리, 이벤트)', env.length === 3 && JSON.parse(env[0]).event_id === ev.event_id && JSON.parse(env[1]).type === 'event' && JSON.parse(env[2]).event_id === ev.event_id);
t('envelope: 머리에 보낸 시각', typeof JSON.parse(env[0]).sent_at === 'string');

// ── judgeReport
const fresh = () => ({ count: 0, seen: {} });
const norm = (name, message, stack) => ({ name, message, stack: stack || '' });
t('판단: 보통 오류는 보냄', judgeReport(norm('TypeError', 'x is undefined'), fresh()).send === true);
t('판단: ApiError 는 안 보냄 (서버가 일부러 준 오류)', judgeReport(norm('ApiError', 'Unauthorized'), fresh()).reason === 'api-error');
t('판단: ResizeObserver 알림은 안 보냄', judgeReport(norm('Error', 'ResizeObserver loop completed with undelivered notifications.'), fresh()).reason === 'noise');
t('판단: 내용 없는 Script error. 는 안 보냄', judgeReport(norm('Error', 'Script error.'), fresh()).reason === 'cross-origin');
t('판단: 확장 프로그램 오류는 안 보냄', judgeReport(norm('Error', 'x', 'at f (chrome-extension://abc/content.js:1:1)'), fresh()).reason === 'extension');
const st = fresh(); st.count = MAX_EVENTS;
t('판단: 한도(' + MAX_EVENTS + '건)를 넘으면 안 보냄', judgeReport(norm('Error', 'a'), st).reason === 'limit');
const st2 = fresh();
st2.seen['Error|a|'] = true;
t('판단: 이미 본 오류는 안 보냄', judgeReport(norm('Error', 'a'), st2).reason === 'duplicate');
t('판단: 문구가 다르면 다른 오류', judgeReport(norm('Error', 'b'), st2).send === true);

// ── captureException / reportMetric (전송 함수를 바꿔 끼움)
const sent = [];
const run = async () => {
  setTransport((url, body) => { sent.push({ url, body }); return Promise.resolve({ ok: true }); });

  resetSentry();
  setTransport((url, body) => { sent.push({ url, body }); return Promise.resolve({ ok: true }); });
  t('초기화: 올바른 DSN 이면 true', initSentry({ dsn: 'https://k@o1.ingest.sentry.io/9', environment: 'test', release: 'r1' }) === true);
  const first = new Error('first');
  const r1 = await captureException(first, 'manual');
  t('보내기: 성공', r1.sent === true && /^[0-9a-f]{32}$/.test(r1.eventId), JSON.stringify(r1));
  t('보내기: envelope 주소로', sent.length === 1 && sent[0].url === 'https://o1.ingest.sentry.io/api/9/envelope/?sentry_key=k&sentry_version=7', sent[0] && sent[0].url);
  t('보내기: 본문에 환경과 버전', JSON.parse(sent[0].body.split('\n')[2]).environment === 'test' && JSON.parse(sent[0].body.split('\n')[2]).release === 'r1');
  const r2 = await captureException(first, 'manual');   // 같은 오류(같은 종류, 문구, 난 자리)
  t('보내기: 같은 오류는 한 번만', r2.sent === false && r2.reason === 'duplicate' && sent.length === 1);
  const other = new Error('first');   // 문구가 같아도 난 자리가 다르면 다른 오류
  t('보내기: 문구가 같아도 난 자리가 다르면 다른 오류로 봄', (await captureException(other, 'manual')).sent === true);
  for (let i = 0; i < 20; i += 1) await captureException(new Error('many ' + i), 'manual');
  t('보내기: 한 화면에 ' + MAX_EVENTS + '건까지만', sent.length === MAX_EVENTS, sent.length);
  const r3 = await captureException(new Error('over limit'), 'manual');
  t('보내기: 한도 뒤는 안 보냄', r3.sent === false && r3.reason === 'limit');

  resetSentry();
  sent.length = 0;
  setTransport(() => Promise.reject(new Error('network down')));
  initSentry({ dsn: 'https://k@o1.ingest.sentry.io/9' });
  const r4 = await captureException(new Error('send fails'), 'manual');
  t('전송이 실패해도 오류를 던지지 않고 결과만', r4.sent === false && r4.reason === 'send-failed', JSON.stringify(r4));

  resetSentry();
  sent.length = 0;
  setTransport((url, body) => { sent.push({ url, body }); return Promise.resolve({}); });
  t('초기화: 잘못된 DSN 이면 false (아무것도 안 보냄)', initSentry({ dsn: 'nope' }) === false);
  const r5 = await captureException(new Error('no config'), 'manual');   // 서버에서 설정을 받으려 하지만 Node 에는 서버가 없음 → 설정 없음
  t('DSN 이 없으면 보내지 않음', r5.sent === false && r5.reason === 'no-dsn' && sent.length === 0, JSON.stringify(r5));

  resetSentry();
  sent.length = 0;
  setTransport((url, body) => { sent.push({ url, body }); return Promise.resolve({}); });
  initSentry({ dsn: 'https://k@o1.ingest.sentry.io/9' });
  const m1 = await reportMetric('audio.underrun', 3);
  t('지표: 보냄', m1.sent === true && JSON.parse(sent[0].body.split('\n')[2]).message === 'metric audio.underrun');
  const m2 = await reportMetric('audio.underrun', 4);
  t('지표: 같은 이름은 한 화면에 한 번만', m2.sent === false && m2.reason === 'limit');
  t('지표: 이름과 값이 이상하면 안 보냄', (await reportMetric('', 1)).reason === 'invalid' && (await reportMetric('x', 'abc')).reason === 'invalid');
  t('지표: 이름의 이상한 글자는 지움', (await reportMetric('a b/c<d>', 1)).sent === true && JSON.parse(sent[1].body.split('\n')[2]).message === 'metric abcd');
  const r6 = await captureException(undefined, 'manual');
  t('오류가 아닌 값(undefined)도 안전하게 보냄', r6.sent === true, JSON.stringify(r6));
  t('처리기 설치는 Node 에서 아무 일도 안 함', installHandlers() === false);
  resetSentry();
};
await run();

// ── 연결: 모든 페이지 진입 파일이 첫 import 로 불러옴
const pagesDir = path.resolve('studionx/frontend/static/js/pages');
['home', 'join', 'mypage', 'myproject', 'privacy', 'resetPassword', 'sequencer', 'userinfo'].forEach(function (name) {
  const src = fs.readFileSync(path.join(pagesDir, name + '.js'), 'utf-8');
  const firstImport = src.split(/\r?\n/).filter(function (l) { return /^import /.test(l); })[0];
  t('연결: ' + name + '.js 의 첫 import 가 sentry-init', firstImport === "import '../core/sentry-init.js';", firstImport);
});

// ── 이 파일이 다른 파일을 불러오지 않음 (가장 먼저 실행되어야 하므로)
const selfSrc = fs.readFileSync(path.resolve('studionx/frontend/static/js/core/sentry-init.js'), 'utf-8');
t('sentry-init.js 는 다른 파일을 import 하지 않음', !/^import /m.test(selfSrc));
t('sentry-init.js 에 최신 문법(?. ?? ??= ||= &&=)이 없음', !/\?\.|\?\?|\|\|=|&&=/.test(selfSrc.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, '""')));

console.log(`\n${ok}/${ok + bad} passed`);
process.exit(bad ? 1 : 0);
