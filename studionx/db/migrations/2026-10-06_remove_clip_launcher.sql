-- Studio Nx 변경: 클립 런처 제거 (2026-10-06, 사용자 결정 — 런치패드 공연용 기능이라 쓰지 않음)
-- 대상: 2026-10-06_sequencer_feature_gaps.sql 까지 실행한 기존 DB (새로 만드는 DB는 02 SQL 에 이미 반영됨)
-- ⚠ 한 번만 실행. 런처 슬롯 클립(clips.scene_id 값이 있는 행)이 있으면 먼저 지우거나 타임라인으로 옮기기
-- 실행 (PowerShell): mysql -u studionx_app -p studionx -e "source studionx/db/migrations/2026-10-06_remove_clip_launcher.sql"

USE studionx;

DELETE FROM clips WHERE scene_id IS NOT NULL;

ALTER TABLE clips
  DROP FOREIGN KEY fk_clips_scene,
  DROP INDEX uq_clips_launcher_slot,
  DROP COLUMN scene_id;

DROP TABLE IF EXISTS launcher_scenes;
