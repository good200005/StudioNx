// 플러그인 정의(param_schema)를 DB 시드 파일에서 읽기 (S1-12)
// 서버나 DB 없이 테스트가 돌도록, 시드 SQL(studionx/db/02_phase2_sequencer.sql)을 직접 읽습니다.
// 시드가 바뀌면(기본값, 범위, 새 파라미터) 렌더링 결과도 달라질 수 있으므로, 회귀 테스트가 그 변화를 잡습니다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(HERE, '..', '..', '..', 'db', '02_phase2_sequencer.sql');

/**
 * @returns {Object<string, Array<object>>} 플러그인 code → param_schema
 */
export function loadPluginSchemas() {
  const sql = fs.readFileSync(SEED, 'utf-8');
  const out = {};
  const re = /\(\s*'(\w+)'\s*,\s*'[^']*'\s*,\s*'(?:INSTRUMENT|EFFECT|MIDI_EFFECT)'\s*,\s*'\w+'\s*,\s*'[^']*'\s*,\s*'(\[\{.*?\}\])'\s*,/g;
  let m;
  while ((m = re.exec(sql)) !== null) out[m[1]] = JSON.parse(m[2]);
  return out;
}
