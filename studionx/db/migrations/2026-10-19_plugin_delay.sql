-- Studio Nx 변경: Delay 플러그인 추가 (2026-10-19, FR-243)
-- 두 DAW(Ableton Live, FL Studio)의 기본 이펙트 비교 결과 1단계에 포함하기로 결정 (docs/Default_Instruments_Effects.md).
-- 새로 만드는 DB 는 db/02_phase2_sequencer.sql 에 이미 들어 있으므로 이 파일은 기존 DB 용입니다.
-- 여러 번 실행해도 안전 (code 가 UNIQUE 라 ON DUPLICATE KEY UPDATE 로 갱신).
-- 실행 (PowerShell): mysql -u studionx_app -p studionx -e "source studionx/db/migrations/2026-10-19_plugin_delay.sql"

USE studionx;

INSERT INTO plugins (code, name, plugin_type, engine, version, param_schema, card_asset, is_active)
VALUES
('delay', 'Delay', 'EFFECT', 'WEBAUDIO', '1.0.0', '[{"key":"time","name":"Time","group":"Main","min":0.01,"max":2,"default":0.35,"unit":"s","step":0.01,"primary":true},{"key":"sync","name":"Sync","type":"toggle","group":"Main","default":false},{"key":"division","name":"Division","type":"select","group":"Main","default":"1/8","options":[{"value":"1/4","label":"1/4"},{"value":"1/8","label":"1/8"},{"value":"1/8d","label":"1/8 dotted"},{"value":"1/16","label":"1/16"}]},{"key":"feedback","name":"Feedback","group":"Main","min":0,"max":0.95,"default":0.4,"step":0.01,"primary":true},{"key":"tone","name":"Tone","group":"Main","min":200,"max":20000,"default":6000,"unit":"Hz","step":1,"curve":"log"},{"key":"mix","name":"Mix","group":"Main","min":0,"max":1,"default":0.3,"step":0.01,"primary":true}]', NULL, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  plugin_type = VALUES(plugin_type),
  engine = VALUES(engine),
  version = VALUES(version),
  param_schema = VALUES(param_schema),
  card_asset = VALUES(card_asset),
  is_active = VALUES(is_active);
