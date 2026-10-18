-- Studio Nx DDL: Phase 2 — 시퀀서 코어 (샘플, 태그, 플러그인, 트랙, 디바이스, 패턴, 클립, 노트, 오토메이션, 템플릿, UI 설정)
-- 원본: docs/DB.md §5 (DB.md를 고치면 이 파일도 함께 갱신)
-- 실행 순서: 00 → 01 → 02 → 03 → 04 → 05 → 06 (앞 파일의 테이블을 FK로 참조)
-- 테이블: samples, tags, sample_tags, plugins, plugin_presets, tracks, track_plugins, track_plugin_links, patterns, clips, track_instruments, track_sends, track_connections, midi_notes, midi_cc_events, automation_lanes, automation_points, tempo_changes, meter_changes, markers, project_templates, user_settings

USE studionx;

CREATE TABLE samples (
  sample_id         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  owner_id          BIGINT UNSIGNED  NOT NULL,
  name              VARCHAR(200)     NOT NULL,
  original_filename VARCHAR(255)     NOT NULL,
  file_path         VARCHAR(500)     NOT NULL,
  mime_type         VARCHAR(100)     NOT NULL,
  file_size         BIGINT UNSIGNED  NOT NULL,
  duration_ms       INT UNSIGNED     NULL,
  sample_rate       INT UNSIGNED     NULL,
  channels          TINYINT UNSIGNED NULL,
  bpm               DECIMAL(6,2)     NULL,
  music_key         VARCHAR(10)      NULL,
  waveform_path     VARCHAR(500)     NULL,
  source            ENUM('UPLOAD','SEPARATION','EXPORT','RECORDING','BOUNCE','RESAMPLE') NOT NULL DEFAULT 'UPLOAD',
  created_at        DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)      NULL,
  PRIMARY KEY (sample_id),
  KEY idx_samples_owner (owner_id),
  CONSTRAINT fk_samples_owner FOREIGN KEY (owner_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE tags (
  tag_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50)  NOT NULL,
  category   ENUM('GENRE','INSTRUMENT','MOOD','ETC') NOT NULL DEFAULT 'ETC',
  is_system  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tag_id),
  UNIQUE KEY uq_tags_category_name (category, name)
) ENGINE=InnoDB;

CREATE TABLE sample_tags (
  sample_id BIGINT UNSIGNED NOT NULL,
  tag_id    INT UNSIGNED    NOT NULL,
  PRIMARY KEY (sample_id, tag_id),
  KEY idx_sample_tags_tag (tag_id),
  CONSTRAINT fk_st_sample FOREIGN KEY (sample_id) REFERENCES samples (sample_id) ON DELETE CASCADE,
  CONSTRAINT fk_st_tag    FOREIGN KEY (tag_id)    REFERENCES tags (tag_id)       ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE plugins (
  plugin_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(50)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  plugin_type  ENUM('INSTRUMENT','EFFECT','MIDI_EFFECT') NOT NULL,
  engine       ENUM('WEBAUDIO','WASM') NOT NULL DEFAULT 'WEBAUDIO',
  version      VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
  param_schema JSON         NOT NULL,
  card_asset   VARCHAR(100) NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (plugin_id),
  UNIQUE KEY uq_plugins_code (code)
) ENGINE=InnoDB;

CREATE TABLE plugin_presets (
  preset_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plugin_id  INT UNSIGNED    NOT NULL,
  owner_id   BIGINT UNSIGNED NULL,
  name       VARCHAR(100)    NOT NULL,
  params     JSON            NOT NULL,
  source     ENUM('SYSTEM','USER','AI') NOT NULL DEFAULT 'USER',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (preset_id),
  KEY idx_presets_plugin (plugin_id),
  CONSTRAINT fk_presets_plugin FOREIGN KEY (plugin_id) REFERENCES plugins (plugin_id),
  CONSTRAINT fk_presets_owner  FOREIGN KEY (owner_id)  REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE tracks (
  track_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id           BIGINT UNSIGNED NOT NULL,
  name                 VARCHAR(100)    NOT NULL,
  track_type           ENUM('AUDIO','MIDI','MASTER','GROUP','RETURN') NOT NULL,
  order_index          INT UNSIGNED    NOT NULL DEFAULT 0,
  color                CHAR(7)         NOT NULL DEFAULT '#7C5CFF',
  volume_db            DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
  pan                  DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  is_muted             TINYINT(1)      NOT NULL DEFAULT 0,
  is_solo              TINYINT(1)      NOT NULL DEFAULT 0,
  is_enabled           TINYINT(1)      NOT NULL DEFAULT 1,
  parent_track_id      BIGINT UNSIGNED NULL,
  frozen_sample_id     BIGINT UNSIGNED NULL,
  routing_mode         ENUM('CHAIN','PATCHER') NOT NULL DEFAULT 'CHAIN',
  assignee_id          BIGINT UNSIGNED NULL,
  locked_by            BIGINT UNSIGNED NULL,
  locked_at            DATETIME(3)     NULL,
  created_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (track_id),
  KEY idx_tracks_project_order (project_id, order_index),
  CONSTRAINT fk_tracks_project    FOREIGN KEY (project_id)           REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_tracks_parent     FOREIGN KEY (parent_track_id)      REFERENCES tracks (track_id) ON DELETE SET NULL,
  CONSTRAINT fk_tracks_frozen     FOREIGN KEY (frozen_sample_id)     REFERENCES samples (sample_id) ON DELETE SET NULL,
  CONSTRAINT fk_tracks_assignee   FOREIGN KEY (assignee_id)          REFERENCES users (user_id),
  CONSTRAINT fk_tracks_locked_by  FOREIGN KEY (locked_by)            REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE track_plugins (
  track_plugin_id BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  track_id        BIGINT UNSIGNED  NOT NULL,
  plugin_id       INT UNSIGNED     NOT NULL,
  slot_index      TINYINT UNSIGNED NOT NULL,
  node_x          INT              NULL,
  node_y          INT              NULL,
  params          JSON             NOT NULL,
  is_bypassed     TINYINT(1)       NOT NULL DEFAULT 0,
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (track_plugin_id),
  UNIQUE KEY uq_track_plugins_slot (track_id, slot_index),
  CONSTRAINT fk_tp_track  FOREIGN KEY (track_id)  REFERENCES tracks (track_id) ON DELETE CASCADE,
  CONSTRAINT fk_tp_plugin FOREIGN KEY (plugin_id) REFERENCES plugins (plugin_id)
) ENGINE=InnoDB;

CREATE TABLE track_plugin_links (
  link_id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  track_id             BIGINT UNSIGNED  NOT NULL,
  from_track_plugin_id BIGINT UNSIGNED  NULL,
  from_port            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  to_track_plugin_id   BIGINT UNSIGNED  NULL,
  to_port              TINYINT UNSIGNED NOT NULL DEFAULT 0,
  gain_db              DECIMAL(5,2)     NOT NULL DEFAULT 0.00,
  created_at           DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (link_id),
  KEY idx_links_track (track_id),
  CONSTRAINT fk_links_track FOREIGN KEY (track_id)             REFERENCES tracks (track_id)               ON DELETE CASCADE,
  CONSTRAINT fk_links_from  FOREIGN KEY (from_track_plugin_id) REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE,
  CONSTRAINT fk_links_to    FOREIGN KEY (to_track_plugin_id)   REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE
) ENGINE=InnoDB;

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

CREATE TABLE patterns (
  pattern_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  BIGINT UNSIGNED NOT NULL,
  name        VARCHAR(100)    NOT NULL,
  color       CHAR(7)         NULL,
  length_tick INT UNSIGNED    NOT NULL DEFAULT 3840,
  swing       DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (pattern_id),
  KEY idx_patterns_project (project_id),
  CONSTRAINT fk_patterns_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT chk_patterns_swing  CHECK (swing BETWEEN 0.00 AND 1.00)
) ENGINE=InnoDB;

CREATE TABLE clips (
  clip_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_id    BIGINT UNSIGNED NOT NULL,
  clip_type   ENUM('AUDIO','MIDI') NOT NULL,
  sample_id   BIGINT UNSIGNED NULL,
  pattern_id  BIGINT UNSIGNED NULL,
  name        VARCHAR(100)    NULL,
  start_tick  INT UNSIGNED    NOT NULL,
  length_tick INT UNSIGNED    NOT NULL,
  offset_tick INT UNSIGNED    NOT NULL DEFAULT 0,
  gain_db     DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
  is_looped   TINYINT(1)      NOT NULL DEFAULT 0,
  fade_in_tick    INT UNSIGNED  NOT NULL DEFAULT 0,
  fade_out_tick   INT UNSIGNED  NOT NULL DEFAULT 0,
  fade_in_curve   DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  fade_out_curve  DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  warp_mode       ENUM('OFF','BEATS','TONES','TEXTURE','REPITCH','COMPLEX') NOT NULL DEFAULT 'BEATS',
  warp_markers    JSON          NULL,
  pitch_semitones DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  is_reversed     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (clip_id),
  KEY idx_clips_track_start (track_id, start_tick),
  CONSTRAINT fk_clips_track  FOREIGN KEY (track_id)  REFERENCES tracks (track_id) ON DELETE CASCADE,
  KEY idx_clips_pattern (pattern_id),
  CONSTRAINT fk_clips_sample  FOREIGN KEY (sample_id)  REFERENCES samples (sample_id),
  CONSTRAINT fk_clips_pattern FOREIGN KEY (pattern_id) REFERENCES patterns (pattern_id),
  CONSTRAINT chk_clips_kind CHECK (
    (clip_type = 'MIDI'  AND pattern_id IS NOT NULL AND sample_id IS NULL) OR
    (clip_type = 'AUDIO' AND sample_id  IS NOT NULL AND pattern_id IS NULL)
  ),
  CONSTRAINT chk_clips_fade_curve CHECK (fade_in_curve BETWEEN -1.00 AND 1.00 AND fade_out_curve BETWEEN -1.00 AND 1.00),
  CONSTRAINT chk_clips_pitch      CHECK (pitch_semitones BETWEEN -48.00 AND 48.00)
) ENGINE=InnoDB;

CREATE TABLE midi_notes (
  note_id     BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pattern_id  BIGINT UNSIGNED  NOT NULL,
  pitch       TINYINT UNSIGNED NOT NULL,
  velocity    TINYINT UNSIGNED NOT NULL DEFAULT 100,
  start_tick  INT UNSIGNED     NOT NULL,
  length_tick INT UNSIGNED     NOT NULL,
  channel     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  release_velocity   TINYINT UNSIGNED NOT NULL DEFAULT 64,
  is_muted           TINYINT(1)       NOT NULL DEFAULT 0,
  probability        DECIMAL(3,2)     NOT NULL DEFAULT 1.00,
  velocity_deviation TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (note_id),
  KEY idx_notes_pattern_start (pattern_id, start_tick),
  CONSTRAINT fk_notes_pattern FOREIGN KEY (pattern_id) REFERENCES patterns (pattern_id) ON DELETE CASCADE,
  CONSTRAINT chk_notes_pitch    CHECK (pitch <= 127),
  CONSTRAINT chk_notes_velocity CHECK (velocity BETWEEN 1 AND 127),
  CONSTRAINT chk_notes_release  CHECK (release_velocity <= 127),
  CONSTRAINT chk_notes_prob     CHECK (probability BETWEEN 0.00 AND 1.00),
  CONSTRAINT chk_notes_vel_dev  CHECK (velocity_deviation <= 127)
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

CREATE TABLE automation_lanes (
  lane_id         BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  track_id        BIGINT UNSIGNED   NOT NULL,
  target_type     ENUM('VOLUME','PAN','INSTRUMENT_PARAM','DEVICE_PARAM') NOT NULL,
  track_plugin_id BIGINT UNSIGNED   NULL,
  param_index     SMALLINT UNSIGNED NULL,
  is_enabled      TINYINT(1)        NOT NULL DEFAULT 1,
  created_at      DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (lane_id),
  KEY idx_lanes_track (track_id),
  CONSTRAINT fk_lanes_track  FOREIGN KEY (track_id)        REFERENCES tracks (track_id)               ON DELETE CASCADE,
  CONSTRAINT fk_lanes_device FOREIGN KEY (track_plugin_id) REFERENCES track_plugins (track_plugin_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE automation_points (
  point_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lane_id  BIGINT UNSIGNED NOT NULL,
  tick     INT UNSIGNED    NOT NULL,
  value    DECIMAL(12,4)   NOT NULL,
  curve    DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  PRIMARY KEY (point_id),
  KEY idx_points_lane_tick (lane_id, tick),
  CONSTRAINT fk_points_lane FOREIGN KEY (lane_id) REFERENCES automation_lanes (lane_id) ON DELETE CASCADE,
  CONSTRAINT chk_points_curve CHECK (curve BETWEEN -1.00 AND 1.00)
) ENGINE=InnoDB;

-- 템포·박자 지도: 시작 값은 projects.bpm / time_sig_*, 곡 중간 변경점만 저장 (2026-10-05)
CREATE TABLE tempo_changes (
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

CREATE TABLE meter_changes (
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

CREATE TABLE project_templates (
  template_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id     BIGINT UNSIGNED NULL,
  name         VARCHAR(100)    NOT NULL,
  description  VARCHAR(500)    NULL,
  genre_tag_id INT UNSIGNED    NULL,
  data         JSON            NOT NULL,
  preview_path VARCHAR(500)    NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (template_id),
  KEY idx_templates_owner (owner_id),
  CONSTRAINT fk_templates_owner FOREIGN KEY (owner_id)     REFERENCES users (user_id),
  CONSTRAINT fk_templates_genre FOREIGN KEY (genre_tag_id) REFERENCES tags (tag_id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_template FOREIGN KEY (template_id) REFERENCES project_templates (template_id) ON DELETE SET NULL;

CREATE TABLE user_settings (
  user_id            BIGINT UNSIGNED NOT NULL,
  theme              ENUM('DARK','LIGHT','SYSTEM') NOT NULL DEFAULT 'DARK',
  accent_color       CHAR(7)         NOT NULL DEFAULT '#7C5CFF',
  ui_scale           DECIMAL(3,2)    NOT NULL DEFAULT 1.00,
  keybindings        JSON            NULL,
  tutorial_state     JSON            NULL,
  character_enabled  TINYINT(1)      NOT NULL DEFAULT 1,
  character_code     VARCHAR(50)     NOT NULL DEFAULT 'nyxi',
  character_state    JSON            NULL,
  tips_level         ENUM('OFF','IMPORTANT','ALL') NOT NULL DEFAULT 'IMPORTANT',
  tips_state         JSON            NULL,
  bottom_panel_state JSON            NULL,
  ui_settings        JSON            NULL,
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 시스템 플러그인 시드 (S1-09, FR-241·242·243)
-- 카드·상세 모달 UI 는 plugins.param_schema 를 읽어 자동 생성한다 (FR-244·2187).
-- 여러 번 실행해도 안전하다 (code 가 UNIQUE 라 ON DUPLICATE KEY UPDATE 로 갱신).
-- ---------------------------------------------------------------------------
INSERT INTO plugins (code, name, plugin_type, engine, version, param_schema, card_asset, is_active)
VALUES
('synth_sub', 'Subtractive Synth', 'INSTRUMENT', 'WEBAUDIO', '1.0.0',
 '[{"key":"osc1_wave","name":"Wave","type":"select","group":"Osc 1","default":"saw","options":[{"value":"sine","label":"Sine"},{"value":"triangle","label":"Triangle"},{"value":"saw","label":"Saw"},{"value":"square","label":"Square"}]},{"key":"osc1_level","name":"Level","group":"Osc 1","min":0,"max":1,"default":1,"step":0.01},{"key":"osc1_detune","name":"Detune","group":"Osc 1","min":-100,"max":100,"default":0,"unit":"ct","step":1},{"key":"osc2_wave","name":"Wave","type":"select","group":"Osc 2","default":"saw","options":[{"value":"sine","label":"Sine"},{"value":"triangle","label":"Triangle"},{"value":"saw","label":"Saw"},{"value":"square","label":"Square"}]},{"key":"osc2_level","name":"Level","group":"Osc 2","min":0,"max":1,"default":0,"step":0.01},{"key":"osc2_detune","name":"Detune","group":"Osc 2","min":-100,"max":100,"default":0,"unit":"ct","step":1},{"key":"osc2_semi","name":"Semi","group":"Osc 2","min":-24,"max":24,"default":0,"unit":"st","step":1},{"key":"filter_type","name":"Type","type":"select","group":"Filter","default":"lowpass","options":[{"value":"lowpass","label":"Low Pass"},{"value":"highpass","label":"High Pass"},{"value":"bandpass","label":"Band Pass"}]},{"key":"cutoff","name":"Cutoff","group":"Filter","min":20,"max":20000,"default":1200,"unit":"Hz","step":1,"curve":"log","primary":true},{"key":"resonance","name":"Resonance","group":"Filter","min":0,"max":1,"default":0.1,"step":0.01,"primary":true},{"key":"env_attack","name":"Attack","group":"Amp Env","min":0,"max":5,"default":0.01,"unit":"s","step":0.01,"primary":true},{"key":"env_decay","name":"Decay","group":"Amp Env","min":0,"max":5,"default":0.3,"unit":"s","step":0.01},{"key":"env_sustain","name":"Sustain","group":"Amp Env","min":0,"max":1,"default":0.7,"step":0.01},{"key":"env_release","name":"Release","group":"Amp Env","min":0,"max":5,"default":0.5,"unit":"s","step":0.01},{"key":"lfo_rate","name":"Rate","group":"LFO","min":0.01,"max":20,"default":1,"unit":"Hz","step":0.01},{"key":"lfo_depth","name":"Depth","group":"LFO","min":0,"max":1,"default":0,"step":0.01,"primary":true},{"key":"lfo_target","name":"Target","type":"select","group":"LFO","default":"off","options":[{"value":"off","label":"Off"},{"value":"pitch","label":"Pitch"},{"value":"filter","label":"Filter"},{"value":"amp","label":"Amp"}]}]', NULL, 1),
('sampler', 'Sampler', 'INSTRUMENT', 'WEBAUDIO', '1.0.0', '[{"key":"root_note","name":"Root","group":"Sample","min":0,"max":127,"default":60,"step":1},{"key":"loop","name":"Loop","type":"toggle","group":"Sample","default":false},{"key":"gain","name":"Gain","group":"Sample","min":0,"max":2,"default":1,"step":0.01,"primary":true},{"key":"tune","name":"Tune","group":"Sample","min":-24,"max":24,"default":0,"unit":"st","step":1,"primary":true},{"key":"attack","name":"Attack","group":"Amp Env","min":0,"max":5,"default":0,"unit":"s","step":0.01},{"key":"decay","name":"Decay","group":"Amp Env","min":0,"max":5,"default":0,"unit":"s","step":0.01,"primary":true},{"key":"sustain","name":"Sustain","group":"Amp Env","min":0,"max":1,"default":1,"step":0.01},{"key":"release","name":"Release","group":"Amp Env","min":0,"max":5,"default":0.2,"unit":"s","step":0.01}]', NULL, 1),
('eq3', 'EQ 3-Band', 'EFFECT', 'WEBAUDIO', '1.0.0', '[{"key":"low_gain","name":"Low Gain","group":"Low","min":-24,"max":24,"default":0,"unit":"dB","step":0.1,"primary":true},{"key":"low_freq","name":"Low Freq","group":"Low","min":20,"max":500,"default":200,"unit":"Hz","step":1,"curve":"log"},{"key":"mid_gain","name":"Mid Gain","group":"Mid","min":-24,"max":24,"default":0,"unit":"dB","step":0.1,"primary":true},{"key":"mid_freq","name":"Mid Freq","group":"Mid","min":200,"max":4000,"default":1000,"unit":"Hz","step":1,"curve":"log"},{"key":"mid_q","name":"Mid Q","group":"Mid","min":0.1,"max":10,"default":0.7,"step":0.1},{"key":"high_gain","name":"High Gain","group":"High","min":-24,"max":24,"default":0,"unit":"dB","step":0.1,"primary":true},{"key":"high_freq","name":"High Freq","group":"High","min":2000,"max":20000,"default":6000,"unit":"Hz","step":1,"curve":"log"}]', NULL, 1),
('compressor', 'Compressor', 'EFFECT', 'WEBAUDIO', '1.0.0', '[{"key":"threshold","name":"Threshold","group":"Main","min":-60,"max":0,"default":-20,"unit":"dB","step":0.1,"primary":true},{"key":"ratio","name":"Ratio","group":"Main","min":1,"max":20,"default":4,"step":0.1,"primary":true},{"key":"attack","name":"Attack","group":"Main","min":0.001,"max":1,"default":0.01,"unit":"s","step":0.001},{"key":"release","name":"Release","group":"Main","min":0.01,"max":2,"default":0.2,"unit":"s","step":0.01},{"key":"knee","name":"Knee","group":"Main","min":0,"max":40,"default":10,"unit":"dB","step":0.1},{"key":"makeup","name":"Makeup","group":"Main","min":0,"max":24,"default":0,"unit":"dB","step":0.1}]', NULL, 1),
('reverb', 'Reverb', 'EFFECT', 'WEBAUDIO', '1.0.0', '[{"key":"mix","name":"Mix","group":"Main","min":0,"max":1,"default":0.3,"step":0.01,"primary":true},{"key":"decay","name":"Decay","group":"Main","min":0.1,"max":10,"default":2,"unit":"s","step":0.1,"primary":true},{"key":"pre_delay","name":"Pre-Delay","group":"Main","min":0,"max":0.2,"default":0.02,"unit":"s","step":0.005},{"key":"damping","name":"Damping","group":"Main","min":0,"max":1,"default":0.5,"step":0.01,"primary":true}]', NULL, 1),
('gain', 'Gain / Utility', 'EFFECT', 'WEBAUDIO', '1.0.0', '[{"key":"gain","name":"Gain","group":"Main","min":-60,"max":24,"default":0,"unit":"dB","step":0.1,"primary":true},{"key":"pan","name":"Pan","group":"Main","min":-1,"max":1,"default":0,"step":0.01},{"key":"phase_invert","name":"Phase Invert","type":"toggle","group":"Main","default":false}]', NULL, 1),
('limiter', 'Limiter', 'EFFECT', 'WEBAUDIO', '1.0.0', '[{"key":"ceiling","name":"Ceiling","group":"Main","min":-12,"max":0,"default":-0.3,"unit":"dB","step":0.1,"primary":true},{"key":"release","name":"Release","group":"Main","min":0.01,"max":1,"default":0.1,"unit":"s","step":0.01,"primary":true}]', NULL, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  plugin_type = VALUES(plugin_type),
  engine = VALUES(engine),
  version = VALUES(version),
  param_schema = VALUES(param_schema),
  card_asset = VALUES(card_asset),
  is_active = VALUES(is_active);
