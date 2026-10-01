-- Studio Nx DDL: Phase 3 — 오디오 출력
-- 원본: docs/DB.md §5 (DB.md를 고치면 이 파일도 함께 갱신)
-- 실행 순서: 00 → 01 → 02 → 03 → 04 → 05 → 06 (앞 파일의 테이블을 FK로 참조)
-- 테이블: export_jobs

USE studionx;

CREATE TABLE export_jobs (
  export_id        BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  project_id       BIGINT UNSIGNED   NOT NULL,
  user_id          BIGINT UNSIGNED   NOT NULL,
  format           ENUM('WAV','MP3','FLAC') NOT NULL,
  sample_rate      INT UNSIGNED      NOT NULL DEFAULT 44100,
  bit_depth        TINYINT UNSIGNED  NULL,
  bitrate_kbps     SMALLINT UNSIGNED NULL,
  range_start_tick INT UNSIGNED      NOT NULL DEFAULT 0,
  range_end_tick   INT UNSIGNED      NULL,
  render_mode      ENUM('CLIENT','SERVER') NOT NULL DEFAULT 'CLIENT',
  status           ENUM('PENDING','PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  progress         TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  result_path      VARCHAR(500)      NULL,
  file_size        BIGINT UNSIGNED   NULL,
  error_message    VARCHAR(1000)     NULL,
  created_at       DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)       NULL,
  PRIMARY KEY (export_id),
  KEY idx_export_project (project_id),
  KEY idx_export_status (status),
  CONSTRAINT fk_export_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_export_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;
