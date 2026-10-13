-- Studio Nx 변경: 시퀀서 기능 보강 (2026-10-06, P1-15 시퀀서 설계)
-- docs/Sequencer_Feature_Gaps.md A·B + PRD 02 §4.17 [DB 필요] 항목
-- 대상: 2026-10-05_tempo_meter_changes.sql 까지 실행한 기존 DB (새로 만드는 DB는 02·03 SQL 에 이미 반영됨)
-- ⚠ 한 번만 실행 (ALTER ... ADD COLUMN 은 다시 실행하면 오류). tracks.instrument_* 컬럼을 지우므로 Phase 2 데이터가 있다면 먼저 백업
-- 실행 (PowerShell): mysql -u studionx_app -p studionx -e "source studionx/db/migrations/2026-10-06_sequencer_feature_gaps.sql"

USE studionx;

ALTER TABLE tracks
  DROP FOREIGN KEY fk_tracks_instrument,
  DROP COLUMN instrument_plugin_id,
  DROP COLUMN instrument_params,
  MODIFY COLUMN track_type ENUM('AUDIO','MIDI','MASTER','GROUP','RETURN') NOT NULL,
  ADD COLUMN is_enabled       TINYINT(1)      NOT NULL DEFAULT 1 AFTER is_solo,
  ADD COLUMN parent_track_id  BIGINT UNSIGNED NULL AFTER is_enabled,
  ADD COLUMN frozen_sample_id BIGINT UNSIGNED NULL AFTER parent_track_id,
  ADD CONSTRAINT fk_tracks_parent FOREIGN KEY (parent_track_id)  REFERENCES tracks (track_id)   ON DELETE SET NULL,
  ADD CONSTRAINT fk_tracks_frozen FOREIGN KEY (frozen_sample_id) REFERENCES samples (sample_id) ON DELETE SET NULL;

ALTER TABLE samples
  MODIFY COLUMN source ENUM('UPLOAD','SEPARATION','EXPORT','RECORDING','BOUNCE','RESAMPLE') NOT NULL DEFAULT 'UPLOAD';

ALTER TABLE plugins
  MODIFY COLUMN plugin_type ENUM('INSTRUMENT','EFFECT','MIDI_EFFECT') NOT NULL;

ALTER TABLE clips
  ADD COLUMN fade_in_tick    INT UNSIGNED NOT NULL DEFAULT 0     AFTER is_looped,
  ADD COLUMN fade_out_tick   INT UNSIGNED NOT NULL DEFAULT 0     AFTER fade_in_tick,
  ADD COLUMN fade_in_curve   DECIMAL(3,2) NOT NULL DEFAULT 0.00  AFTER fade_out_tick,
  ADD COLUMN fade_out_curve  DECIMAL(3,2) NOT NULL DEFAULT 0.00  AFTER fade_in_curve,
  ADD COLUMN warp_mode       ENUM('OFF','BEATS','TONES','TEXTURE','REPITCH','COMPLEX') NOT NULL DEFAULT 'BEATS' AFTER fade_out_curve,
  ADD COLUMN warp_markers    JSON         NULL                   AFTER warp_mode,
  ADD COLUMN pitch_semitones DECIMAL(5,2) NOT NULL DEFAULT 0.00  AFTER warp_markers,
  ADD COLUMN is_reversed     TINYINT(1)   NOT NULL DEFAULT 0     AFTER pitch_semitones,
  ADD CONSTRAINT chk_clips_fade_curve CHECK (fade_in_curve BETWEEN -1.00 AND 1.00 AND fade_out_curve BETWEEN -1.00 AND 1.00),
  ADD CONSTRAINT chk_clips_pitch      CHECK (pitch_semitones BETWEEN -48.00 AND 48.00);

ALTER TABLE midi_notes
  ADD COLUMN release_velocity   TINYINT UNSIGNED NOT NULL DEFAULT 64   AFTER channel,
  ADD COLUMN is_muted           TINYINT(1)       NOT NULL DEFAULT 0    AFTER release_velocity,
  ADD COLUMN probability        DECIMAL(3,2)     NOT NULL DEFAULT 1.00 AFTER is_muted,
  ADD COLUMN velocity_deviation TINYINT UNSIGNED NOT NULL DEFAULT 0    AFTER probability,
  ADD CONSTRAINT chk_notes_release CHECK (release_velocity <= 127),
  ADD CONSTRAINT chk_notes_prob    CHECK (probability BETWEEN 0.00 AND 1.00),
  ADD CONSTRAINT chk_notes_vel_dev CHECK (velocity_deviation <= 127);

ALTER TABLE patterns
  ADD COLUMN swing DECIMAL(3,2) NOT NULL DEFAULT 0.00 AFTER length_tick,
  ADD CONSTRAINT chk_patterns_swing CHECK (swing BETWEEN 0.00 AND 1.00);

ALTER TABLE export_jobs
  ADD COLUMN export_mode ENUM('MIXDOWN','STEMS') NOT NULL DEFAULT 'MIXDOWN' AFTER render_mode;

CREATE TABLE track_instruments (
  track_instrument_id BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  track_id            BIGINT UNSIGNED  NOT NULL,
  plugin_id           INT UNSIGNED     NOT NULL,
  slot_index          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  params              JSON             NULL,
  volume_db           DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  pan                 DECIMAL(3,2)     NOT NULL DEFAULT 0.00,
  is_solo             TINYINT(1)       NOT NULL DEFAULT 0,
  is_enabled          TINYINT(1)       NOT NULL DEFAULT 1,
  created_at          DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (track_instrument_id),
  UNIQUE KEY uq_track_instruments_slot (track_id, slot_index),
  CONSTRAINT fk_ti_track  FOREIGN KEY (track_id)  REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_ti_plugin FOREIGN KEY (plugin_id) REFERENCES plugins (plugin_id)
) ENGINE=InnoDB;

CREATE TABLE track_sends (
  send_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_id        BIGINT UNSIGNED NOT NULL,
  return_track_id BIGINT UNSIGNED NOT NULL,
  level_db        DECIMAL(5,2)    NOT NULL DEFAULT -12.00,
  is_pre_fader    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (send_id),
  UNIQUE KEY uq_track_sends (track_id, return_track_id),
  CONSTRAINT fk_sends_track  FOREIGN KEY (track_id)        REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_sends_return FOREIGN KEY (return_track_id) REFERENCES tracks (track_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE track_connections (
  connection_id      BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  from_track_id      BIGINT UNSIGNED  NOT NULL,
  to_track_id        BIGINT UNSIGNED  NOT NULL,
  target             ENUM('PLUGIN','INSTRUMENTS') NOT NULL DEFAULT 'PLUGIN',
  to_track_plugin_id BIGINT UNSIGNED  NULL,
  to_port            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  also_play          TINYINT(1)       NULL,
  volume_db          DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  pan                DECIMAL(3,2)     NOT NULL DEFAULT 0.00,
  is_solo            TINYINT(1)       NOT NULL DEFAULT 0,
  created_at         DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (connection_id),
  UNIQUE KEY uq_connections_from (from_track_id),
  KEY idx_connections_to (to_track_id),
  CONSTRAINT fk_conn_from   FOREIGN KEY (from_track_id)      REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_conn_to     FOREIGN KEY (to_track_id)        REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_conn_plugin FOREIGN KEY (to_track_plugin_id) REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE midi_cc_events (
  event_id   BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  pattern_id BIGINT UNSIGNED   NOT NULL,
  tick       INT UNSIGNED      NOT NULL,
  controller SMALLINT UNSIGNED NOT NULL,
  value      SMALLINT UNSIGNED NOT NULL,
  channel    TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id),
  KEY idx_cc_pattern_tick (pattern_id, controller, tick),
  CONSTRAINT fk_cc_pattern FOREIGN KEY (pattern_id) REFERENCES patterns (pattern_id) ON DELETE CASCADE,
  CONSTRAINT chk_cc_controller CHECK (controller <= 129),
  CONSTRAINT chk_cc_value      CHECK (value <= 16383)
) ENGINE=InnoDB;

CREATE TABLE markers (
  marker_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  tick       INT UNSIGNED    NOT NULL,
  name       VARCHAR(50)     NOT NULL,
  color      CHAR(7)         NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (marker_id),
  KEY idx_markers_project_tick (project_id, tick),
  CONSTRAINT fk_markers_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE
) ENGINE=InnoDB;
