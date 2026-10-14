-- Studio Nx 변경: 비밀번호 찾기 (2026-10-14, P1-28, PRD 01 FR-118~119)
-- 대상: 01 을 이미 실행한 기존 DB (새로 만드는 DB는 01_phase1_account.sql 에 이미 반영됨)
-- 실행 (PowerShell): mysql -u root -p studionx -e "source studionx/db/migrations/2026-10-14_password_reset.sql"
-- 내용: users.password_changed_at 추가 + password_reset_tokens 테이블 (토큰은 해시만 저장)

USE studionx;

ALTER TABLE users
  ADD COLUMN password_changed_at DATETIME(3) NULL AFTER last_login_at;

CREATE TABLE password_reset_tokens (
  token_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64)        NOT NULL,
  expires_at  DATETIME(3)     NOT NULL,
  used_at     DATETIME(3)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_password_reset_tokens_hash (token_hash),
  KEY idx_password_reset_tokens_user (user_id),
  KEY idx_password_reset_tokens_expires (expires_at),
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
