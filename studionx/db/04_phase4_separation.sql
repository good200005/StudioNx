-- Studio Nx DDL: Phase 4 — 악기 분리
-- 원본: docs/DB.md §5 (DB.md를 고치면 이 파일도 함께 갱신)
-- 실행 순서: 00 → 01 → 02 → 03 → 04 → 05 → 06 (앞 파일의 테이블을 FK로 참조)
-- 테이블: separation_jobs, separation_stems

USE studionx;

CREATE TABLE separation_jobs (
  separation_id    BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED  NOT NULL,
  source_sample_id BIGINT UNSIGNED  NOT NULL,
  model_name       VARCHAR(50)      NOT NULL,
  stem_mode        ENUM('2STEM','4STEM','6STEM') NOT NULL DEFAULT '4STEM',
  status           ENUM('PENDING','PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  progress         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  error_message    VARCHAR(1000)    NULL,
  created_at       DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)      NULL,
  PRIMARY KEY (separation_id),
  KEY idx_sep_user (user_id),
  KEY idx_sep_status (status),
  CONSTRAINT fk_sep_user   FOREIGN KEY (user_id)          REFERENCES users (user_id),
  CONSTRAINT fk_sep_source FOREIGN KEY (source_sample_id) REFERENCES samples (sample_id)
) ENGINE=InnoDB;

CREATE TABLE separation_stems (
  stem_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  separation_id BIGINT UNSIGNED NOT NULL,
  stem_type     ENUM('VOCALS','DRUMS','BASS','GUITAR','PIANO','OTHER','ACCOMPANIMENT') NOT NULL,
  sample_id     BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (stem_id),
  UNIQUE KEY uq_stems_job_type (separation_id, stem_type),
  UNIQUE KEY uq_stems_sample (sample_id),
  CONSTRAINT fk_stems_job    FOREIGN KEY (separation_id) REFERENCES separation_jobs (separation_id) ON DELETE CASCADE,
  CONSTRAINT fk_stems_sample FOREIGN KEY (sample_id)     REFERENCES samples (sample_id)
) ENGINE=InnoDB;
