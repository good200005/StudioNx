-- Studio Nx: 새 database + 애플리케이션 전용 계정 생성 (MySQL 8.0)
-- 실행: mysql -u root -p < db/00_create_database.sql
-- 앱 계정 비밀번호는 studionx/.env 의 DB_PASSWORD 와 같아야 합니다. (개발용 값 — 운영에서는 반드시 변경)
-- 테이블 생성 SQL은 docs/DB.md §5 (Phase별로 db/ 에 추가 예정)

CREATE DATABASE IF NOT EXISTS studionx
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'studionx_app'@'localhost' IDENTIFIED BY 'nyxiadmin';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON studionx.* TO 'studionx_app'@'localhost';
-- 개발 단계에서는 테이블 생성 권한(CREATE/ALTER/DROP)까지 부여. 운영에서는 DML 권한만 남길 것.
FLUSH PRIVILEGES;
