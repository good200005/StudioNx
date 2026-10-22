// S1-14 시퀀서 로딩 화면 순수 함수 시험 — 종류 정하기, 최소 시간, 단계 계획, 진행률 합산, 부드럽게 따라가기, 파형, 문구, 샘플 모으기 (브라우저 불필요)
// 소스 점검도 함께: 마크업, CSS 안전장치, 최신 문법 금지, 시험 도구의 표시
// 실행: node docs/handoff/s1-14_tests/loader_unit.mjs
import fs from 'node:fs';
import {
  loaderMode, minDisplayMs, stagePlan, overallProgress, easeDisplayed, wavePath, projectInfoText, collectSampleIds, sampleCountText, HARD_TIMEOUT_MS,
} from '../../../studionx/frontend/static/js/pages/sequencer-loader.js';

let ok = 0, bad = 0;
const t = (n, c, d) => { if (c) ok++; else { bad++; console.log('FAIL', n, d === undefined ? '' : d); } };
const near = (x, y, tol) => Math.abs(x - y) <= tol;
const read = (p) => fs.readFileSync(p, 'utf-8');

// ── loaderMode
t('종류: projectId 가 없으면 demo', loaderMode('', false) === 'demo' && loaderMode('?new=1', false) === 'demo');
t('종류: ?new=1 이면 new', loaderMode('?projectId=5&new=1', true) === 'new');
t('종류: new 가 없거나 1 이 아니면 open', loaderMode('?projectId=5', true) === 'open' && loaderMode('?projectId=5&new=0', true) === 'open' && loaderMode('?projectId=5&new=true', true) === 'open');
t('종류: search 가 없어도 던지지 않음', loaderMode(undefined, true) === 'open' && loaderMode(null, true) === 'open');

// ── minDisplayMs
t('최소 시간: open 1600, new 1100, demo 800', minDisplayMs('open', false) === 1600 && minDisplayMs('new', false) === 1100 && minDisplayMs('demo', false) === 800);
t('최소 시간: 움직임 줄이기면 0', minDisplayMs('open', true) === 0 && minDisplayMs('new', true) === 0 && minDisplayMs('demo', true) === 0);
t('최소 시간: new 가 open 보다 짧음 (샘플이 없으므로)', minDisplayMs('new', false) < minDisplayMs('open', false));

// ── stagePlan
const sum = (p) => p.reduce((s, x) => s + x.weight, 0);
const pOpen = stagePlan('open', 34);
t('계획(open, 샘플 있음): 세 단계 PROJECT DATA, SAMPLES, AUDIO ENGINE', pOpen.map((s) => s.id + ':' + s.label).join() === 'data:PROJECT DATA,content:SAMPLES,engine:AUDIO ENGINE', pOpen.map((s) => s.label).join());
t('계획(open, 샘플 있음): 샘플 비중이 가장 큼', pOpen[1].weight > pOpen[0].weight && pOpen[1].weight > pOpen[2].weight);
t('계획: 비중의 합이 1', [pOpen, stagePlan('open', 0), stagePlan('open', null), stagePlan('new', 0), stagePlan('demo', 0)].every((p) => near(sum(p), 1, 1e-9)));
t('계획(open, 샘플 0개): NO SAMPLES, 샘플 비중이 작아짐', stagePlan('open', 0)[1].label === 'NO SAMPLES' && stagePlan('open', 0)[1].weight < 0.2);
t('계획(open, 샘플 수를 아직 모름): SAMPLES 로 봄 (깜빡임 방지)', stagePlan('open', null)[1].label === 'SAMPLES' && stagePlan('open', undefined)[1].label === 'SAMPLES');
t('계획(new): CREATING PROJECT, MASTER TRACK, AUDIO ENGINE', stagePlan('new', 0).map((s) => s.label).join() === 'CREATING PROJECT,MASTER TRACK,AUDIO ENGINE');
t('계획(demo): EXAMPLE PROJECT, TRACKS, AUDIO ENGINE', stagePlan('demo', 0).map((s) => s.label).join() === 'EXAMPLE PROJECT,TRACKS,AUDIO ENGINE');

// ── overallProgress
t('진행률: 빈 목록과 전부 0 이면 0', overallProgress([]) === 0 && overallProgress(undefined) === 0 && overallProgress([{ weight: 1, fraction: 0 }]) === 0);
t('진행률: 비중에 따라 합산 (0.3 이 끝, 0.7 은 안 끝 → 0.3)', near(overallProgress([{ weight: 0.3, fraction: 1 }, { weight: 0.7, fraction: 0 }]), 0.3, 1e-9));
t('진행률: 절반씩 진행', near(overallProgress([{ weight: 0.5, fraction: 0.5 }, { weight: 0.5, fraction: 0.5 }]), 0.5, 1e-9));
t('진행률: 모두 끝이면 1', overallProgress(stagePlan('open', 5).map((s) => ({ weight: s.weight, fraction: 1 }))) === 1);
t('진행률: 1 을 넘거나 음수인 값은 잘라서 0~1', overallProgress([{ weight: 1, fraction: 5 }]) === 1 && overallProgress([{ weight: 1, fraction: -3 }]) === 0);
t('진행률: 비중이 0 이거나 이상하면 무시 (0 으로 나누지 않음)', overallProgress([{ weight: 0, fraction: 1 }]) === 0 && overallProgress([{ weight: NaN, fraction: 1 }, { weight: 1, fraction: 1 }]) === 1);
t('진행률: 숫자가 아닌 진행은 0', overallProgress([{ weight: 1, fraction: 'abc' }]) === 0);

// ── easeDisplayed
t('따라가기: 목표보다 앞서지 않음', easeDisplayed(0.2, 0.5, 5000, 0, 16) <= 0.5 && easeDisplayed(0.2, 0.5, 5000, 0, 16) > 0.2);
t('따라가기: 줄어들지 않음 (목표가 더 작아도 그대로)', easeDisplayed(0.6, 0.3, 5000, 0, 16) === 0.6);
t('따라가기: 최소 시간이 있으면 그 시간에 비례한 값 이상으로 못 감 (400/1600 → 0.25)', easeDisplayed(0.2, 1, 400, 1600, 5000) <= 0.25 + 1e-9);
t('따라가기: 시간이 0 이거나 음수여도 던지지 않음', easeDisplayed(0, 1, 0, 1600, 16) === 0 && easeDisplayed(0, 1, -50, 1600, 16) === 0 && easeDisplayed(0.1, 1, 9999, 0, -10) === 0.1);
t('따라가기: 최소 시간 0 이면 한도 없음', easeDisplayed(0, 1, 0, 0, 100000) === 1);
t('따라가기: 목표에 아주 가까우면 목표로 붙음', easeDisplayed(0.9996, 1, 99999, 0, 16) === 1);
{
  // 프레임을 돌려 봄: 목표 1, 최소 1600ms → 1600ms 전에는 100% 가 아니고, 1600ms 뒤 곧 100%
  let d = 0, ms = 0, reached = -1, last = 0, monotone = true;
  while (ms < 6000) { ms += 16; d = easeDisplayed(d, 1, ms, 1600, 16); if (d < last) monotone = false; last = d; if (d >= 1 && reached < 0) reached = ms; }
  t('프레임 모의(최소 1600ms): 1600ms 전에는 100% 가 안 됨', reached >= 1600, reached);
  t('프레임 모의(최소 1600ms): 1600~2400ms 안에 100% 가 됨', reached >= 1600 && reached <= 2400, reached);
  t('프레임 모의: 값이 줄어들지 않음', monotone);
  let d2 = 0, ms2 = 0, reached2 = -1;
  while (ms2 < 6000) { ms2 += 16; d2 = easeDisplayed(d2, 0.4, ms2, 1600, 16); if (d2 >= 0.4 && reached2 < 0) reached2 = ms2; }
  t('프레임 모의: 목표가 40% 에서 멈추면 40% 를 넘지 않고 40% 에 닿음', d2 === 0.4 && reached2 > 0, d2);
}

// ── wavePath
const wp = wavePath(1440, 1);
const pts = wp.split(' L').length - 1;   // 맨 앞의 M0 60 을 뺀 L 점의 수
t('파형: 1440 너비면 L 점이 241개 (6칸마다)', pts === 241, pts);
t('파형: 시작은 M0 60', wp.indexOf('M0 60 L0 60.0') === 0, wp.slice(0, 24));
t('파형: 같은 입력은 같은 모양', wavePath(1440, 1) === wavePath(1440, 1));
t('파형: 모든 y 가 0~120 안', wp.split(' L').slice(1).every((p) => { const y = Number(p.split(' ')[1]); return y >= 0 && y <= 120; }));
{
  const amp = (d) => Math.max.apply(null, d.split(' L').slice(1).map((p) => Math.abs(Number(p.split(' ')[1]) - 60)));
  t('파형: calm 이 작으면 진폭이 작음', amp(wavePath(1440, 0.55)) < amp(wavePath(1440, 1)) * 0.7, amp(wavePath(1440, 0.55)) + ' / ' + amp(wavePath(1440, 1)));
  t('파형: 양 끝은 신호선(60)으로 잦아듦', near(Number(wp.split(' L')[1].split(' ')[1]), 60, 0.5) && near(Number(wp.split(' L').slice(-1)[0].split(' ')[1]), 60, 1), wp.split(' L').slice(-1)[0]);
}
t('파형: 너비가 작아도 던지지 않고 점이 있음', wavePath(10, 1).split(' L').length > 5 && wavePath(0, 1).length > 10);
t('파형: 너비가 달라지면 점의 수가 달라짐', wavePath(720, 1).split(' L').length < wavePath(1440, 1).split(' L').length);

// ── projectInfoText
const info = projectInfoText({ bpm: '128.00', time_sig_num: 4, time_sig_den: 4, music_key: 'A', scale_mode: 'minor' }, 5, 'open');
t('정보 글: "128 BPM · 4/4 · A MINOR · 5 TRACKS"', info === '128 BPM · 4/4 · A MINOR · 5 TRACKS', info);
t('정보 글: 소수 BPM 은 둘째 자리까지', projectInfoText({ bpm: '124.50' }, 1, 'open').indexOf('124.50 BPM') === 0, projectInfoText({ bpm: '124.50' }, 1, 'open'));
t('정보 글: 트랙 하나면 TRACK (복수형 아님)', projectInfoText({ bpm: 120 }, 1, 'open').slice(-7) === '1 TRACK', projectInfoText({ bpm: 120 }, 1, 'open'));
t('정보 글: 트랙 0개도 0 TRACKS', projectInfoText({ bpm: 120 }, 0, 'open').slice(-8) === '0 TRACKS');
t('정보 글: 값이 없는 칸은 건너뜀 (Key 없음)', projectInfoText({ bpm: 120, time_sig_num: 3, time_sig_den: 4 }, 2, 'open') === '120 BPM · 3/4 · 2 TRACKS', projectInfoText({ bpm: 120, time_sig_num: 3, time_sig_den: 4 }, 2, 'open'));
t('정보 글: 새 프로젝트는 트랙 수 대신 MASTER TRACK ONLY', projectInfoText({ bpm: '120.00', time_sig_num: 4, time_sig_den: 4 }, 0, 'new') === '120 BPM · 4/4 · MASTER TRACK ONLY');
t('정보 글: project 가 없어도 던지지 않음', projectInfoText(null, 3, 'open') === '3 TRACKS' && projectInfoText(undefined, 0, 'new') === 'MASTER TRACK ONLY');
t('정보 글: BPM 이 이상하면 건너뜀', projectInfoText({ bpm: 'abc' }, 1, 'open') === '1 TRACK' && projectInfoText({ bpm: 0 }, 1, 'open') === '1 TRACK');
t('정보 글: Key 는 대문자', projectInfoText({ bpm: 90, music_key: 'c#', scale_mode: 'major' }, 1, 'open').indexOf('C# MAJOR') > 0);

// ── collectSampleIds / sampleCountText
t('샘플 모으기: 클립과 Sampler 의 샘플을 중복 없이', JSON.stringify(collectSampleIds([{ sample_id: 3 }, { sample_id: 3 }, { sample_id: 5 }], [5, 9])) === '[3,5,9]', JSON.stringify(collectSampleIds([{ sample_id: 3 }, { sample_id: 3 }, { sample_id: 5 }], [5, 9])));
t('샘플 모으기: MIDI 클립(sample_id 없음)과 null 은 건너뜀', JSON.stringify(collectSampleIds([{ sample_id: null }, { pattern_id: 4 }, null, {}], [null, '', undefined])) === '[]');
t('샘플 모으기: 문자열 번호는 숫자로, 이상한 값은 버림', JSON.stringify(collectSampleIds([{ sample_id: '12' }, { sample_id: 'abc' }], ['7', NaN])) === '[12,7]', JSON.stringify(collectSampleIds([{ sample_id: '12' }, { sample_id: 'abc' }], ['7', NaN])));
t('샘플 모으기: 입력이 없어도 던지지 않음', collectSampleIds(undefined, undefined).length === 0 && collectSampleIds(null, null).length === 0);
t('샘플 개수 글: "12/34", 음수는 0', sampleCountText(12, 34) === '12/34' && sampleCountText(-1, -5) === '0/0');
t('시간 제한 상수: 25초', HARD_TIMEOUT_MS === 25000);

// ── 소스 점검: 마크업, CSS, 문법, 시험 도구
const html = read('studionx/frontend/studioNx.html');
const bodyStart = html.indexOf('<body');
const bodyOpenEnd = html.indexOf('>', bodyStart) + 1;
const afterBody = html.slice(bodyOpenEnd);
const firstElement = /<([a-z]+)[^>]*id="([^"]*)"/.exec(afterBody.replace(/<!--[\s\S]*?-->/g, ''));
t('마크업: 로딩 화면(#sq-loader)이 body 의 첫 요소 (첫 그림부터 보임)', firstElement && firstElement[2] === 'sq-loader', firstElement && firstElement[2]);
t('마크업: role=progressbar 와 aria 값', /id="sq-loader"[^>]*role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"[^>]*aria-valuenow="0"/.test(html));
['sq-ld__kind', 'sq-ld__name', 'sq-ld__info', 'sq-ld__line', 'sq-ld__wave', 'sq-ld__flat', 'sq-ld__pct', 'sq-ld__no', 'sq-ld__yes', 'sq-ld__half--top', 'sq-ld__half--bot'].forEach(function (c) {
  t('마크업: ' + c + ' 가 있음', html.indexOf(c) > 0);
});
t('마크업: 세 단계(data, content, engine)와 샘플 개수 칸', ['data', 'content', 'engine'].every((s) => html.indexOf('data-step="' + s + '"') > 0) && (html.match(/sq-ld__cnt/g) || []).length === 3);
t('마크업: 단계 글자 뒤에 글 노드가 있음 (JS 가 글만 바꾸려고)', /<span class="sq-ld__st">PROJECT DATA <span class="sq-ld__cnt">/.test(html));
const css = read('studionx/frontend/static/css/pages/studio.css');
t('CSS: 안전장치 — 30초 뒤 저절로 숨김', /\.sq-ld\s*\{[^}]*animation:\s*sq-ld-failsafe 1ms linear 30s forwards/.test(css) && /@keyframes sq-ld-failsafe\s*\{\s*to\s*\{\s*visibility:\s*hidden;\s*pointer-events:\s*none/.test(css));
t('CSS: 로딩 화면이 모든 것 위(z-index 1000)', /\.sq-ld\s*\{[^}]*z-index:\s*1000/.test(css));
t('CSS: 종류가 정해지기 전에는 종류 문구와 단계를 숨김', css.indexOf('.sq-ld:not(.is-open):not(.is-new):not(.is-demo) .sq-ld__kind') > 0 && css.indexOf('.sq-ld__steps { visibility: hidden; }') > 0);
t('CSS: 움직임 줄이기 대응', /prefers-reduced-motion: reduce\)\s*\{[^}]*\.sq-ld/.test(css.slice(css.indexOf('S1-14'))));
t('CSS: 위아래로 열리는 규칙(is-opening)', css.indexOf('.sq-ld.is-opening .sq-ld__half--top { transform: translateY(-100%); }') > 0 && css.indexOf('.sq-ld.is-opening .sq-ld__half--bot { transform: translateY(100%); }') > 0);
const loaderSrc = read('studionx/frontend/static/js/pages/sequencer-loader.js');
const code = loaderSrc.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, '""');
t('소스: sequencer-loader.js 에 최신 문법(?. ?? ??= ||= &&=)이 없음', !/\?\.|\?\?|\|\|=|&&=/.test(code));
const seqSrc = read('studionx/frontend/static/js/pages/sequencer.js');
t('연결: 예시 화면은 저장되지 않는다는 안내를 제목 줄에 적음', seqSrc.indexOf("title: 'Example Project', info: 'SAMPLE DATA, NOTHING IS SAVED'") > 0);
t('연결: sequencer.js 가 로딩 화면을 만들고 끝까지 기다림', seqSrc.indexOf('createLoader({ mode: mode })') > 0 && seqSrc.indexOf('await openWithLoader(loader, data, mode)') > 0 && seqSrc.indexOf('await loader.finish()') > 0);
t('연결: sentry-init 이 여전히 sequencer.js 의 첫 import', seqSrc.split(/\r?\n/).filter((l) => /^import /.test(l))[0] === "import '../core/sentry-init.js';");
t('연결: 읽기 실패와 예외에도 열림 (fail → finish)', /loader\.fail\(\);[\s\S]*?await openWithLoader/.test(seqSrc) && /catch \(err\) \{\s*loader\.fail\(\);/.test(seqSrc));
const libSrc = read('docs/handoff/p1-28_tests/lib.mjs');
t('시험 도구: 기본으로 로딩 화면을 끄는 표시를 넣고, launch 의 loader 옵션으로 켤 수 있음', libSrc.indexOf('window.__snxNoLoader = true') > 0 && libSrc.indexOf('opts = {}') > 0 && libSrc.indexOf('if (!opts.loader)') > 0);

console.log(`\n${ok}/${ok + bad} passed`);
process.exit(bad ? 1 : 0);
