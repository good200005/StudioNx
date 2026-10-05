# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-09 비밀번호 변경·회원 탈퇴  — purge_withdrawn_accounts
#   브랜치  : feature/phase1/p1-09-password-withdraw
#   순서    : 3단계 — P1-08 병합 후
#
# P1-12 문의 등록·반복 전송 제한  — purge_old_inquiries
#   브랜치  : feature/phase1/p1-12-inquiry-api
#   순서    : 3단계 — P1-03~05 병합 후
#
# 시작 전 : git switch <위 작업 중 지금 할 작업의 브랜치>
#           (이 파일은 작업이 여럿 — 위 순서대로 한 작업씩, 각자 자기 브랜치에서)
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/Privacy_Policy_Draft.md §4 · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""보관 기간 정리 작업 — 개인정보 처리방침의 "언제 지우는가"를 실제로 지키는 곳 (2026-10-05).

처리방침(privacy.html §4)에 적은 약속:
    - 탈퇴한 계정: 이메일·닉네임은 3일 보관 뒤 비움        → purge_withdrawn_accounts
    - 문의: 답변 후 1년 뒤 삭제                            → purge_old_inquiries

하루 한 번 실행 (둘 중 하나):
    - 운영체제 예약 작업:  ..\\.venv\\Scripts\\python -m app.workers.retention
      (Windows 작업 스케줄러 / 리눅스 cron — 배포할 때 정함)
    - 또는 서버 시작 때 백그라운드 반복 작업 (서버가 여러 대면 중복 실행 주의)
"""

from datetime import datetime

from sqlalchemy.orm import Session

INQUIRY_KEEP_DAYS = 365  # 답변 후 보관 기간 (처리방침 §4)


def purge_withdrawn_accounts(db: Session, now: datetime) -> int:
    """탈퇴 3일이 지난 계정의 이메일·닉네임을 비운다. 비운 계정 수를 돌려준다.

    TODO(P1-09):
    - 대상: status='DELETED' 이고 deleted_at <= now - REJOIN_WAIT_DAYS(3)일 이고
            email 이 아직 'deleted+' 로 시작하지 않는 행 (이미 비운 행은 건너뜀)
    - 각 행에 auth_service.release_withdrawn(db, user) 와 같은 처리
      (email = deleted+{id}@withdrawn.invalid, nickname = deleted_{id})
    - password_hash 도 로그인에 쓸 수 없는 값으로 바꿔 두면 더 안전
      (NOT NULL 이라 빈 값 대신 "!" 같은 표시)
    - 프로필 사진은 탈퇴 때 이미 지움 (user_service.withdraw) — 남아 있으면 여기서도 지움
    - 프로젝트(owner_id)·행 자체는 남김 (화면은 "Deleted user")
    - db.commit() 후 return 개수
    """
    raise NotImplementedError


def purge_old_inquiries(db: Session, now: datetime) -> int:
    """답변 후 1년이 지난 문의를 지운다. 지운 개수를 돌려준다.

    TODO(P1-12):
    - 대상: answered_at IS NOT NULL 이고 answered_at <= now - INQUIRY_KEEP_DAYS 일
    - 행을 실제로 삭제 (DELETE) — 문의는 다른 표가 가리키지 않음
    - (정하기) 답변하지 않은 문의는? 예: 받은 지 1년 지나면 같이 지움
    - db.commit() 후 return 개수
    """
    raise NotImplementedError


def main() -> None:
    """명령으로 한 번 실행: python -m app.workers.retention

    TODO:
    - with SessionLocal() as db: now = datetime.now(UTC)
      두 함수를 부르고 결과를 print (예: "withdrawn accounts: 2, inquiries: 5")
    - 실패하면 Sentry 로 보고되도록 예외를 그대로 올림 (init_sentry(get_settings()) 먼저)
    """
    raise NotImplementedError


if __name__ == "__main__":
    main()
