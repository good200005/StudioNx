-- Studio Nx 변경: 메인 페이지 Contact 폼 · Development 공지 (2026-10-02)
-- 대상: 01~06 을 이미 실행한 기존 DB (새로 만드는 DB는 01_phase1_account.sql 에 이미 반영됨)
-- 실행: mysql -u studionx_app -p studionx < db/migrations/2026-10-02_contact_devnotes.sql
-- 주의: inquiries 에 기존 행이 있으면 privacy_agreed_at(NOT NULL) 추가가 실패할 수 있음 → 현재는 빈 테이블 기준

USE studionx;

-- 1) 문의 폼이 이름을 받지 않음 → name 선택 입력, 개인정보 동의 시각 추가
ALTER TABLE inquiries
  MODIFY COLUMN name VARCHAR(50) NULL,
  ADD COLUMN privacy_agreed_at DATETIME(3) NOT NULL AFTER content;

-- 2) Development 공지 (관리자만 작성, SQLAdmin /admin)
CREATE TABLE IF NOT EXISTS dev_notes (
  note_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id    BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(150)    NOT NULL,
  summary      VARCHAR(300)    NOT NULL,
  content      MEDIUMTEXT      NOT NULL,
  is_published TINYINT(1)      NOT NULL DEFAULT 0,
  published_at DATETIME(3)     NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at   DATETIME(3)     NULL,
  PRIMARY KEY (note_id),
  KEY idx_dev_notes_published (is_published, published_at),
  CONSTRAINT fk_dev_notes_author FOREIGN KEY (author_id) REFERENCES users (user_id)
) ENGINE=InnoDB;
