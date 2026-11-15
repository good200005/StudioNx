-- Studio Nx 변경: automation_lanes 에 track_instrument_id 추가 (2026-11-15, S1-15, FR-2108)
-- INSTRUMENT_PARAM 레인은 악기(track_instruments)의 파라미터를 가리키는데, 기존 track_plugin_id 는 track_plugins 만 참조해서
-- 악기 노브 오토메이션을 저장하면 외래 키 오류가 났습니다. 악기용 칸을 따로 둡니다.
-- 새로 만드는 DB 는 db/02_phase2_sequencer.sql 에 이미 들어 있으므로 이 파일은 기존 DB 용입니다.
-- 한 번만 실행합니다 (이미 컬럼이 있으면 오류가 납니다).
-- 실행 (PowerShell): mysql -u studionx_app -p studionx -e "source studionx/db/migrations/2026-11-15_automation_instrument_lane.sql"

USE studionx;

ALTER TABLE automation_lanes
  ADD COLUMN track_instrument_id BIGINT UNSIGNED NULL AFTER track_plugin_id,
  ADD CONSTRAINT fk_lanes_instrument FOREIGN KEY (track_instrument_id) REFERENCES track_instruments (track_instrument_id) ON DELETE CASCADE;
