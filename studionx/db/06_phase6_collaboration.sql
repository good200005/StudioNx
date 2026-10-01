-- Studio Nx DDL: Phase 6 — 협업 · 톡방 · 코멘트 · 스냅샷
-- 원본: docs/DB.md §5 (DB.md를 고치면 이 파일도 함께 갱신)
-- 실행 순서: 00 → 01 → 02 → 03 → 04 → 05 → 06 (앞 파일의 테이블을 FK로 참조)
-- 테이블: invitations, project_change_logs, chat_messages, timeline_comments, project_snapshots

USE studionx;

-- (project_members는 Phase 1 영역에서 이미 생성)
CREATE TABLE invitations (
  invitation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id    BIGINT UNSIGNED NOT NULL,
  inviter_id    BIGINT UNSIGNED NOT NULL,
  invitee_email VARCHAR(255)    NOT NULL,
  invitee_id    BIGINT UNSIGNED NULL,
  role          ENUM('EDITOR','VIEWER') NOT NULL DEFAULT 'EDITOR',
  token         CHAR(64)        NOT NULL,
  status        ENUM('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELED') NOT NULL DEFAULT 'PENDING',
  expires_at    DATETIME(3)     NOT NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  responded_at  DATETIME(3)     NULL,
  PRIMARY KEY (invitation_id),
  UNIQUE KEY uq_invitations_token (token),
  KEY idx_invitations_project (project_id),
  KEY idx_invitations_email (invitee_email),
  CONSTRAINT fk_inv_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_inviter FOREIGN KEY (inviter_id) REFERENCES users (user_id),
  CONSTRAINT fk_inv_invitee FOREIGN KEY (invitee_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE project_change_logs (
  change_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  revision    INT UNSIGNED    NOT NULL,
  op_type     VARCHAR(50)     NOT NULL,
  target_type VARCHAR(30)     NOT NULL,
  target_id   BIGINT UNSIGNED NULL,
  payload     JSON            NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (change_id),
  UNIQUE KEY uq_changes_project_rev (project_id, revision),
  CONSTRAINT fk_changes_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_changes_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE chat_messages (
  message_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id   BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NULL,
  message_type ENUM('TEXT','SYSTEM') NOT NULL DEFAULT 'TEXT',
  content      TEXT            NOT NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at   DATETIME(3)     NULL,
  PRIMARY KEY (message_id),
  KEY idx_chat_project_msg (project_id, message_id),
  CONSTRAINT fk_chat_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE timeline_comments (
  comment_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id        BIGINT UNSIGNED NOT NULL,
  user_id           BIGINT UNSIGNED NOT NULL,
  parent_comment_id BIGINT UNSIGNED NULL,
  tick              INT UNSIGNED    NULL,
  track_id          BIGINT UNSIGNED NULL,
  clip_id           BIGINT UNSIGNED NULL,
  content           TEXT            NOT NULL,
  resolved_at       DATETIME(3)     NULL,
  resolved_by       BIGINT UNSIGNED NULL,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at        DATETIME(3)     NULL,
  PRIMARY KEY (comment_id),
  KEY idx_comments_project (project_id, resolved_at),
  CONSTRAINT fk_comments_project  FOREIGN KEY (project_id)        REFERENCES projects (project_id)          ON DELETE CASCADE,
  CONSTRAINT fk_comments_user     FOREIGN KEY (user_id)           REFERENCES users (user_id),
  CONSTRAINT fk_comments_parent   FOREIGN KEY (parent_comment_id) REFERENCES timeline_comments (comment_id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_track    FOREIGN KEY (track_id)          REFERENCES tracks (track_id)              ON DELETE SET NULL,
  CONSTRAINT fk_comments_clip     FOREIGN KEY (clip_id)           REFERENCES clips (clip_id)                ON DELETE SET NULL,
  CONSTRAINT fk_comments_resolver FOREIGN KEY (resolved_by)       REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE project_snapshots (
  snapshot_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id    BIGINT UNSIGNED NOT NULL,
  created_by    BIGINT UNSIGNED NULL,
  snapshot_type ENUM('MANUAL','AUTO_DAILY','BEFORE_RESTORE','BEFORE_TEMPLATE','BEFORE_AI_APPLY') NOT NULL,
  name          VARCHAR(100)    NULL,
  revision      INT UNSIGNED    NOT NULL,
  data_path     VARCHAR(500)    NOT NULL,
  preview_path  VARCHAR(500)    NULL,
  size_bytes    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  is_pinned     TINYINT(1)      NOT NULL DEFAULT 0,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (snapshot_id),
  KEY idx_snapshots_project (project_id, created_at),
  CONSTRAINT fk_snapshots_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_snapshots_user    FOREIGN KEY (created_by) REFERENCES users (user_id)
) ENGINE=InnoDB;
