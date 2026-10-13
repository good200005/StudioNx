-- Studio Nx 변경: 템포·박자 지도 (2026-10-05, P1-15 시퀀서 설계)
-- 곡 중간 BPM 변속 · 박자 변경점. 시작 값은 그대로 projects.bpm / time_sig_num / time_sig_den
-- 대상: 01~06 을 이미 실행한 기존 DB (새로 만드는 DB는 02_phase2_sequencer.sql 에 이미 반영됨)
-- 실행 (PowerShell): mysql -u studionx_app -p studionx -e "source studionx/db/migrations/2026-10-05_tempo_meter_changes.sql"

USE studionx;

CREATE TABLE IF NOT EXISTS tempo_changes (
  tempo_change_id BIGINT UNSIGNED       NOT NULL AUTO_INCREMENT,
  project_id      BIGINT UNSIGNED       NOT NULL,
  tick            INT UNSIGNED          NOT NULL,
  bpm             DECIMAL(6,2)          NOT NULL,
  ramp            ENUM('STEP','LINEAR') NOT NULL DEFAULT 'STEP',
  created_at      DATETIME(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tempo_change_id),
  UNIQUE KEY uq_tempo_project_tick (project_id, tick),
  CONSTRAINT fk_tempo_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT chk_tempo_bpm  CHECK (bpm BETWEEN 20.00 AND 300.00),
  CONSTRAINT chk_tempo_tick CHECK (tick > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meter_changes (
  meter_change_id BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  project_id      BIGINT UNSIGNED  NOT NULL,
  tick            INT UNSIGNED     NOT NULL,
  time_sig_num    TINYINT UNSIGNED NOT NULL,
  time_sig_den    TINYINT UNSIGNED NOT NULL,
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (meter_change_id),
  UNIQUE KEY uq_meter_project_tick (project_id, tick),
  CONSTRAINT fk_meter_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT chk_meter_num  CHECK (time_sig_num BETWEEN 1 AND 32),
  CONSTRAINT chk_meter_den  CHECK (time_sig_den IN (1, 2, 4, 8, 16, 32)),
  CONSTRAINT chk_meter_tick CHECK (tick > 0)
) ENGINE=InnoDB;
