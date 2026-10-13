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

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.sentry import init_sentry
from app.db.session import SessionLocal
from app.models import Inquiry, User
from app.models.user import UserStatus
from app.services.auth_service import REJOIN_WAIT_DAYS, release_withdrawn

INQUIRY_KEEP_DAYS = 365  # 답변 후 · (답변 없으면) 받은 뒤 보관 기간 (처리방침 §4, 2026-10-08)


# 다 비운 계정의 비밀번호 칸 값 — bcrypt 해시 모양이 아니라 verify_password 가 늘 False
# (칸이 NOT NULL 이라 빈칸 대신)
WIPED_PASSWORD_HASH = "!"


def purge_withdrawn_accounts(db: Session, now: datetime) -> int:
    """탈퇴 3일이 지난 계정의 개인 정보를 비운다. 비운 계정 수를 돌려준다.

    - 대상: status=DELETED, deleted_at <= now - 3일, 그리고 **아직 남은 것이 하나라도 있는** 행
      (이미 다 비운 행은 건너뜀 — 매일 돌려도 같은 행을 다시 세지 않음)
    - 이메일 · 닉네임: auth_service.release_withdrawn 그대로
      (deleted+{id}@withdrawn.invalid, deleted_user_{id 10자리}) — 가입 때 이미 비켜 둔 행도 같은 값
    - 추적 방지 (2026-10-07): password_hash = "!", last_login_at = None, profile_image_path = None
    - 프로필 사진 파일이 남아 있으면 지움 (보통 탈퇴 때 46 이 이미 지움) — DB 저장 **뒤에**
    - 프로젝트(owner_id) · 행 자체 · deleted_at 은 남김 (화면은 "Deleted user")
    - now: 시간대가 있으면 UTC 로 바꿔 비교 (DB 는 UTC, 시간대 표시 없음)
    (구현: AI — 2026-10-07, 함수 하나씩 검토)
    """
    if now.tzinfo is not None:
        now = now.astimezone(UTC).replace(tzinfo=None)
    cutoff = now - timedelta(days=REJOIN_WAIT_DAYS)
    users = db.scalars(
        select(User).where(
            User.status == UserStatus.DELETED,
            User.deleted_at <= cutoff,
            or_(
                ~User.email.startswith("deleted+", autoescape=True),
                ~User.nickname.startswith("deleted_user_", autoescape=True),
                User.password_hash != WIPED_PASSWORD_HASH,
                User.last_login_at.is_not(None),
                User.profile_image_path.is_not(None),
            ),
        )
    ).all()

    photos = []
    for user in users:
        release_withdrawn(db, user)
        if user.profile_image_path:
            photos.append(user.profile_image_path)
        user.password_hash = WIPED_PASSWORD_HASH
        user.last_login_at = None
        user.profile_image_path = None
    db.commit()

    storage_dir = get_settings().storage_dir
    for relative in photos:
        (storage_dir / relative).unlink(missing_ok=True)
    return len(users)


def purge_old_inquiries(db: Session, now: datetime) -> int:
    """오래된 문의를 지운다. 지운 개수를 돌려준다.

    - 답변한 문의: 답변 후 1년 (처리방침 §4)
    - 답변하지 않은 문의: **받은 뒤 1년** (2026-10-08 사용자 결정 — 이메일이 끝없이 남지 않게)
      → 둘을 합치면 "답변 시각이 있으면 그것, 없으면 받은 시각" 이 1년 지난 행
    - 행을 실제로 삭제 (DELETE) — 문의는 다른 표가 가리키지 않음
    - now: 시간대가 있으면 UTC 로 바꿔 비교 (49 와 같음)
    (구현: AI — 2026-10-08, 함수 하나씩 검토)
    """
    if now.tzinfo is not None:
        now = now.astimezone(UTC).replace(tzinfo=None)
    cutoff = now - timedelta(days=INQUIRY_KEEP_DAYS)
    since = func.coalesce(Inquiry.answered_at, Inquiry.created_at)
    count = db.execute(delete(Inquiry).where(since <= cutoff)).rowcount
    db.commit()
    return count


def main() -> None:
    """명령으로 한 번 실행: python -m app.workers.retention  (하루 한 번 — 예약 작업은 배포 때)

    - Sentry 를 먼저 켬 → 정리 중 오류가 나면 예외를 그대로 올려 Sentry 로 보고되고,
      명령은 실패(0 아닌 종료 코드)
    - 한 세션에서 탈퇴 계정 정리(49) → 문의 정리(54), 기준 시각은 둘이 같게 한 번만 잼
    - 결과를 한 줄 출력: "withdrawn accounts: 2, inquiries: 5" (예약 작업 기록에 남음)
    (구현: AI — 2026-10-08, 함수 하나씩 검토)
    """
    init_sentry(get_settings())
    now = datetime.now(UTC)
    with SessionLocal() as db:
        accounts = purge_withdrawn_accounts(db, now)
        inquiries = purge_old_inquiries(db, now)
    print(f"withdrawn accounts: {accounts}, inquiries: {inquiries}")


if __name__ == "__main__":
    main()
