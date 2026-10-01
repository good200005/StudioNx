-- Studio Nx DDL: Phase 1 — 계정 · 기본 (회원, 문의, 프로젝트, 프로젝트 멤버)
-- 원본: docs/DB.md §5 (DB.md를 고치면 이 파일도 함께 갱신)
-- 실행 순서: 00 → 01 → 02 → 03 → 04 → 05 → 06 (앞 파일의 테이블을 FK로 참조)
-- 테이블: users, inquiries, projects, project_members

USE studionx;

CREATE TABLE users (
  user_id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email              VARCHAR(255)    NOT NULL,
  password_hash      VARCHAR(255)    NOT NULL,
  nickname           VARCHAR(50)     NOT NULL,
  profile_image_path VARCHAR(500)    NULL,
  role               ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  status             ENUM('ACTIVE','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  last_login_at      DATETIME(3)     NULL,
  storage_quota_bytes BIGINT UNSIGNED NOT NULL DEFAULT 5368709120,
  storage_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at         DATETIME(3)     NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nickname (nickname)
) ENGINE=InnoDB;

CREATE TABLE inquiries (
  inquiry_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  name        VARCHAR(50)     NOT NULL,
  email       VARCHAR(255)    NOT NULL,
  title       VARCHAR(200)    NOT NULL,
  content     TEXT            NOT NULL,
  status      ENUM('RECEIVED','ANSWERED','CLOSED') NOT NULL DEFAULT 'RECEIVED',
  answer      TEXT            NULL,
  answered_at DATETIME(3)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (inquiry_id),
  KEY idx_inquiries_status (status),
  CONSTRAINT fk_inquiries_user FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE projects (
  project_id      BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  owner_id        BIGINT UNSIGNED  NOT NULL,
  title           VARCHAR(100)     NOT NULL,
  description     VARCHAR(500)     NULL,
  bpm             DECIMAL(6,2)     NOT NULL DEFAULT 120.00,
  time_sig_num    TINYINT UNSIGNED NOT NULL DEFAULT 4,
  time_sig_den    TINYINT UNSIGNED NOT NULL DEFAULT 4,
  music_key       VARCHAR(10)      NULL,
  scale_mode      VARCHAR(20)      NULL,
  sample_rate     INT UNSIGNED     NOT NULL DEFAULT 48000,
  master_settings JSON             NULL,
  revision        INT UNSIGNED     NOT NULL DEFAULT 0,
  thumbnail_path  VARCHAR(500)     NULL,
  template_id     BIGINT UNSIGNED  NULL,  -- FK는 project_templates 생성 후 ALTER로 추가
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)      NULL,
  PRIMARY KEY (project_id),
  KEY idx_projects_owner (owner_id),
  KEY idx_projects_updated (updated_at),
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

-- project_members는 Phase 6 기능이지만, 프로젝트 생성 시 OWNER 행을 넣기 위해 Phase 1에서 함께 생성
CREATE TABLE project_members (
  project_id           BIGINT UNSIGNED NOT NULL,
  user_id              BIGINT UNSIGNED NOT NULL,
  role                 ENUM('OWNER','EDITOR','VIEWER') NOT NULL DEFAULT 'EDITOR',
  last_read_message_id BIGINT UNSIGNED NULL,
  joined_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (project_id, user_id),
  KEY idx_project_members_user (user_id),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;
