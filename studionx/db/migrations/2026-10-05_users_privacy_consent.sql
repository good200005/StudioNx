-- Studio Nx 변경: 회원가입 개인정보 처리방침 동의 기록 (2026-10-05, docs/Privacy_Policy_Draft.md D3)
-- 대상: 01 을 이미 실행한 기존 DB (새로 만드는 DB는 01_phase1_account.sql 에 이미 반영됨)
-- 실행 (PowerShell): mysql -u root -p studionx -e "source studionx/db/migrations/2026-10-05_users_privacy_consent.sql"
-- 주의: users 에 이미 행이 있으면 NOT NULL 열을 바로 넣을 수 없어 기본값을 잠깐 쓴 뒤 지움
--       (기존 회원은 다시 동의를 받아야 하므로 privacy_version = 'legacy' 로 표시)

USE studionx;

ALTER TABLE users
  ADD COLUMN privacy_agreed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER last_login_at,
  ADD COLUMN privacy_version   VARCHAR(20) NOT NULL DEFAULT 'legacy'         AFTER privacy_agreed_at;

ALTER TABLE users
  ALTER COLUMN privacy_agreed_at DROP DEFAULT,
  ALTER COLUMN privacy_version   DROP DEFAULT;
