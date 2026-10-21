// 오디오 회귀 테스트 실행 (S1-12, PRD 00 §7.1)
// 테스트 프로젝트(projects/*.json)를 앱의 renderOffline 으로 렌더링해 골든 WAV(golden/*.wav)와 비교합니다.
//
// 실행 (저장소 맨 위에서):
//   node studionx/tests/audio/run.mjs                      모든 프로젝트를 비교 (실패하면 종료 코드 1)
//   node studionx/tests/audio/run.mjs --only synth_basic   프로젝트 이름으로 골라서
//   node studionx/tests/audio/run.mjs --update "이유"       의도적으로 소리를 바꾼 경우에만: 골든을 새로 쓰고 이유를 기록
// 서버(FastAPI)와 DB 는 필요 없고, Chrome 만 있으면 됩니다 (환경 변수 CHROME_PATH 로 위치 지정).

import fs from 'node:fs';
import path from 'node:path';
import { openRenderer, loadProjects, buildArgs, goldenPath, GOLDEN_DIR, OUT_DIR } from './lib/runner.mjs';
import { compareRenders } from './lib/metrics.mjs';
import { readWav, writeFloatWav } from './lib/wavio.mjs';

const CHANGELOG = path.join(GOLDEN_DIR, 'CHANGELOG.md');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const num = function (x, d) { return x === -Infinity ? '-inf' : (isFinite(x) ? x.toFixed(d) : String(x)); };

/** 골든 변경 기록에 한 줄 더하기 (파일이 없으면 머리부터 만듦) */
function appendChangelog(rows, reason, chrome) {
  if (!fs.existsSync(CHANGELOG)) {
    fs.writeFileSync(CHANGELOG, [
      '# 골든 WAV 변경 기록',
      '',
      '의도적으로 소리를 바꾼 경우에만 골든을 새로 씁니다 (`node studionx/tests/audio/run.mjs --update "이유"`). 이유와 이전 골든과의 차이를 여기에 남깁니다.',
      '',
      '| 날짜 | 프로젝트 | 이유 | 이전과의 차이 (최대 차이, RMS dBFS, LUFS 차이) | 브라우저 |',
      '|---|---|---|---|---|',
      '',
    ].join('\n'), 'utf-8');
  }
  const date = new Date().toISOString().slice(0, 10);
  const text = rows.map(function (r) {
    const diff = r.cmp ? num(r.cmp.maxDiff, 6) + ', ' + num(r.cmp.rmsDiffDb, 1) + ', ' + num(r.cmp.lufsDiff, 3) : '새로 만듦';
    return '| ' + date + ' | `' + r.name + '` | ' + reason.replace(/\|/g, '/') + ' | ' + diff + ' | ' + chrome + ' |';
  }).join('\n') + '\n';
  fs.appendFileSync(CHANGELOG, text, 'utf-8');
}

async function main() {
  const onlyArg = argValue('--only');
  const only = onlyArg ? onlyArg.split(',') : null;
  const update = process.argv.indexOf('--update') >= 0;
  const reason = update ? (argValue('--update') || '').trim() : '';
  if (update && (!reason || reason.indexOf('--') === 0)) {
    console.error('--update 에는 변경 이유가 필요합니다. 예: --update "Reverb 감쇠 계산 수정"');
    process.exit(2);
  }
  const projects = loadProjects(only);
  if (!projects.length) { console.error('실행할 프로젝트가 없습니다 (--only 이름을 확인하세요)'); process.exit(2); }

  const r = await openRenderer();
  const results = [];
  try {
    for (const p of projects) {
      const t0 = Date.now();
      const out = await r.render(buildArgs(p));
      const ms = Date.now() - t0;
      const gp = goldenPath(p.name);
      const old = fs.existsSync(gp) ? readWav(gp) : null;
      if (update) {
        const cmp = old && old.frames === out.frames ? compareRenders(out.channels, old.channels, out.sampleRate, p.tolerance) : null;
        const bytes = writeFloatWav(gp, out.channels, out.sampleRate);
        results.push({ name: p.name, ms: ms, cmp: cmp, wrote: bytes, pass: true });
        continue;
      }
      if (!old) { results.push({ name: p.name, ms: ms, pass: false, note: '골든이 없습니다. --update "이유"로 만드세요' }); continue; }
      const cmp = compareRenders(out.channels, old.channels, out.sampleRate, p.tolerance);
      if (!cmp.pass) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        writeFloatWav(path.join(OUT_DIR, p.name + '.wav'), out.channels, out.sampleRate);
      }
      results.push({ name: p.name, ms: ms, cmp: cmp, pass: cmp.pass });
    }
  } finally {
    r.close();
  }

  if (update) {
    appendChangelog(results, reason, r.version);
    results.forEach(function (x) { console.log('골든 갱신 ' + x.name + ' (' + (x.wrote / 1048576).toFixed(2) + ' MB)' + (x.cmp ? '  이전과 최대 차이 ' + num(x.cmp.maxDiff, 6) : '  새로 만듦')); });
    console.log('변경 기록: ' + path.relative(process.cwd(), CHANGELOG));
    return;
  }

  console.log('브라우저: ' + r.version);
  console.log('프로젝트'.padEnd(18) + '결과  ' + '최대 차이'.padEnd(12) + 'RMS dBFS'.padEnd(10) + 'LUFS 차이'.padEnd(10) + '골든 LUFS  시간');
  results.forEach(function (x) {
    if (!x.cmp) { console.log(x.name.padEnd(18) + 'FAIL  ' + x.note); return; }
    console.log(x.name.padEnd(18) + (x.pass ? 'PASS  ' : 'FAIL  ') + num(x.cmp.maxDiff, 6).padEnd(12) + num(x.cmp.rmsDiffDb, 1).padEnd(10) + num(x.cmp.lufsDiff, 3).padEnd(10) + num(x.cmp.lufsGolden, 1).padEnd(11) + (x.ms / 1000).toFixed(1) + 's');
    x.cmp.failures.forEach(function (f) { console.log('        - ' + f); });
  });
  const failed = results.filter(function (x) { return !x.pass; });
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' 통과');
  if (failed.length) {
    console.log('실패한 렌더링은 studionx/tests/audio/out/ 에 저장했습니다. 의도한 변경이면 --update "이유"로 골든을 갱신하세요.');
    process.exit(1);
  }
}

main().catch(function (e) { console.error(e); process.exit(2); });
