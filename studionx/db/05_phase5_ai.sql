-- Studio Nx DDL: Phase 5 — AI 레퍼런스 분석 · Nyxi 도우미
-- 원본: docs/DB.md §5 (DB.md를 고치면 이 파일도 함께 갱신)
-- 실행 순서: 00 → 01 → 02 → 03 → 04 → 05 → 06 (앞 파일의 테이블을 FK로 참조)
-- 테이블: reference_tracks, reference_tags, ai_analyses, ai_recommendations, assistant_messages

USE studionx;

CREATE TABLE reference_tracks (
  reference_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  project_id   BIGINT UNSIGNED NULL,
  source_type  ENUM('LINK','FILE') NOT NULL,
  source_url   VARCHAR(1000)   NULL,
  file_path    VARCHAR(500)    NULL,
  title        VARCHAR(200)    NULL,
  genre_text   VARCHAR(100)    NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (reference_id),
  KEY idx_ref_user (user_id),
  KEY idx_ref_project (project_id),
  CONSTRAINT fk_ref_user    FOREIGN KEY (user_id)    REFERENCES users (user_id),
  CONSTRAINT fk_ref_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE SET NULL,
  CONSTRAINT chk_ref_source CHECK (
    (source_type = 'LINK' AND source_url IS NOT NULL) OR
    (source_type = 'FILE' AND file_path  IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE reference_tags (
  reference_id BIGINT UNSIGNED NOT NULL,
  tag_id       INT UNSIGNED    NOT NULL,
  PRIMARY KEY (reference_id, tag_id),
  KEY idx_ref_tags_tag (tag_id),
  CONSTRAINT fk_rt_ref FOREIGN KEY (reference_id) REFERENCES reference_tracks (reference_id) ON DELETE CASCADE,
  CONSTRAINT fk_rt_tag FOREIGN KEY (tag_id)       REFERENCES tags (tag_id)                   ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ai_analyses (
  analysis_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_id     BIGINT UNSIGNED NOT NULL,
  status           ENUM('PENDING','PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  model_version    VARCHAR(50)     NULL,
  bpm              DECIMAL(6,2)    NULL,
  music_key        VARCHAR(10)     NULL,
  loudness_lufs    DECIMAL(5,2)    NULL,
  true_peak_db     DECIMAL(5,2)    NULL,
  dynamic_range_db DECIMAL(5,2)    NULL,
  spectral_profile JSON            NULL,
  features         JSON            NULL,
  summary          TEXT            NULL,
  error_message    VARCHAR(1000)   NULL,
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)     NULL,
  PRIMARY KEY (analysis_id),
  KEY idx_analyses_ref (reference_id),
  CONSTRAINT fk_analyses_ref FOREIGN KEY (reference_id) REFERENCES reference_tracks (reference_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ai_recommendations (
  recommendation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id       BIGINT UNSIGNED NOT NULL,
  project_id        BIGINT UNSIGNED NULL,
  rec_type          ENUM('SYNTH_PRESET','PLUGIN_PRESET','MIXING','MASTERING') NOT NULL,
  target_plugin_id  INT UNSIGNED    NULL,
  settings          JSON            NOT NULL,
  rationale         TEXT            NULL,
  is_applied        TINYINT(1)      NOT NULL DEFAULT 0,
  applied_at        DATETIME(3)     NULL,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (recommendation_id),
  KEY idx_rec_analysis (analysis_id),
  CONSTRAINT fk_rec_analysis FOREIGN KEY (analysis_id)      REFERENCES ai_analyses (analysis_id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_project  FOREIGN KEY (project_id)       REFERENCES projects (project_id)     ON DELETE SET NULL,
  CONSTRAINT fk_rec_plugin   FOREIGN KEY (target_plugin_id) REFERENCES plugins (plugin_id)
) ENGINE=InnoDB;

CREATE TABLE assistant_messages (
  message_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  project_id    BIGINT UNSIGNED NULL,
  role          ENUM('USER','ASSISTANT') NOT NULL,
  content       TEXT            NOT NULL,
  context       JSON            NULL,
  model_version VARCHAR(50)     NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (message_id),
  KEY idx_assist_user_project (user_id, project_id, message_id),
  CONSTRAINT fk_assist_user    FOREIGN KEY (user_id)    REFERENCES users (user_id),
  CONSTRAINT fk_assist_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE SET NULL
) ENGINE=InnoDB;
