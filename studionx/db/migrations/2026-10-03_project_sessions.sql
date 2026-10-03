-- Studio Nx 변경: 프로젝트 작업 세션 (2026-10-03, P1-17 마이페이지)
-- 대상: 01~06 을 이미 실행한 기존 DB (새로 만드는 DB는 01_phase1_account.sql 에 이미 반영됨)
-- 실행 (PowerShell): mysql -u root -p studionx -e "source studionx/db/migrations/2026-10-03_project_sessions.sql"

USE studionx;

-- 시퀀서(Phase 2)가 기록, 마이페이지(Phase 1)가 최근 7일 작업 시간으로 표시
CREATE TABLE IF NOT EXISTS project_sessions (
  session_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id     BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  started_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  active_seconds INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id),
  KEY idx_project_sessions_user (user_id, started_at),
  KEY idx_project_sessions_project (project_id, started_at),
  CONSTRAINT fk_ps_project FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_user    FOREIGN KEY (user_id)    REFERENCES users (user_id)
) ENGINE=InnoDB;
