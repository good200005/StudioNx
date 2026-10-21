-- Studio Nx 변경: Sampler 에 sample_id 와 mode 파라미터 추가 (2026-10-21, S1-11c, FR-241)
-- Sampler 를 MIDI 노트로 연주하려면 어떤 샘플을 울릴지(sample_id)와 연주 방식(mode: classic, oneshot)이 필요합니다.
-- 새로 만드는 DB 는 db/02_phase2_sequencer.sql 에 이미 들어 있으므로 이 파일은 기존 DB 용입니다.
-- 이미 트랙에 붙은 Sampler 의 params 는 그대로 두며, 빠진 키는 화면과 재생이 기본값(sample_id 없음, classic)으로 채웁니다.
-- 여러 번 실행해도 안전 (code 가 UNIQUE 라 ON DUPLICATE KEY UPDATE 로 갱신).
-- 실행 (PowerShell): mysql -u studionx_app -p studionx -e "source studionx/db/migrations/2026-10-21_sampler_sample_mode.sql"

USE studionx;

INSERT INTO plugins (code, name, plugin_type, engine, version, param_schema, card_asset, is_active)
VALUES
('sampler', 'Sampler', 'INSTRUMENT', 'WEBAUDIO', '1.0.0', '[{"key":"sample_id","name":"Sample","type":"sample","group":"Sample","default":null},{"key":"mode","name":"Mode","type":"select","display":"segment","group":"Sample","default":"classic","options":[{"value":"classic","label":"Classic","hint":"Classic: the note length decides how long the sample sounds. Pitch follows the key, and Loop and the full envelope apply."},{"value":"oneshot","label":"One-Shot","hint":"One-Shot: every note plays the whole sample, however short the note is. Loop and the envelope Sustain and Release are ignored. Good for drum hits."}]},{"key":"root_note","name":"Root","group":"Sample","min":0,"max":127,"default":60,"unit":"note","step":1},{"key":"loop","name":"Loop","type":"toggle","group":"Sample","default":false},{"key":"gain","name":"Gain","group":"Sample","min":0,"max":2,"default":1,"step":0.01,"primary":true},{"key":"tune","name":"Tune","group":"Sample","min":-24,"max":24,"default":0,"unit":"st","step":1,"primary":true},{"key":"attack","name":"Attack","group":"Amp Env","min":0,"max":5,"default":0,"unit":"s","step":0.01},{"key":"decay","name":"Decay","group":"Amp Env","min":0,"max":5,"default":0,"unit":"s","step":0.01,"primary":true},{"key":"sustain","name":"Sustain","group":"Amp Env","min":0,"max":1,"default":1,"step":0.01},{"key":"release","name":"Release","group":"Amp Env","min":0,"max":5,"default":0.2,"unit":"s","step":0.01}]', NULL, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  plugin_type = VALUES(plugin_type),
  engine = VALUES(engine),
  version = VALUES(version),
  param_schema = VALUES(param_schema),
  card_asset = VALUES(card_asset),
  is_active = VALUES(is_active);
