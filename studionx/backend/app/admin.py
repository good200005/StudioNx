# ──────────────────────────────────────────────────────────────────────
# [직접 구현 안내] 단계 순서: 1) P1-03 → 2) P1-04·05 → 3) P1-08·09·12·13 → 4) P1-16 → 5) P1-21·22
#
# P1-21 Development 공지 API·SQLAdmin 관리자 화면
#   브랜치  : feature/phase1/p1-21-dev-notes-admin
#   순서    : 5단계 — P1-05·P1-12 병합 후
#
# 시작 전 : git switch feature/phase1/p1-21-dev-notes-admin
#           git merge feature/phase1-account   ← 앞 단계 구현을 받아 오기 (꼭)
# 끝나면  : PR → feature/phase1-account  (병합되면 YouTrack Closed)
# 설명 문서: docs/ai-notes/ (작업별 템플릿 설명) · 순서 원본: docs/Implementation_Plan.md §2.1
# ──────────────────────────────────────────────────────────────────────
"""관리자 화면 /admin — SQLAdmin (PRD 01 FR-115) — 템플릿: 구현은 직접 (P1-21).

ADMIN 계정(users.role = 'ADMIN')만 들어올 수 있고, 공지 작성·공개와 문의 답변을 함.
main.py 에서 setup_admin(app) 를 **프론트 정적 파일 마운트("/")보다 먼저** 호출해야
/admin 주소가 SiteFiles 에 가려지지 않음.

ADMIN 계정 만들기: 일반 가입 후 DB 에서 직접
    UPDATE users SET role = 'ADMIN' WHERE email = '...';
"""

from datetime import UTC, datetime

from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from wtforms import TextAreaField

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import SessionLocal, engine
from app.models import DevNote, Inquiry, User
from app.models.inquiry import InquiryStatus
from app.models.user import UserRole, UserStatus
from app.services import auth_service


class AdminAuth(AuthenticationBackend):
    """/admin 로그인 — API 의 JWT 와 따로, SQLAdmin 자체 세션 쿠키를 씀.

    생성: AdminAuth(secret_key=settings.jwt_secret)  (세션 쿠키 서명용)
    """

    async def login(self, request: Request) -> bool:
        """SQLAdmin 로그인 폼 전송.

        (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
        - 폼의 username(=이메일), password 로 auth_service.authenticate (P1-05)
          — 일반 로그인과 같은 확인 (탈퇴 · 정지 계정, 틀린 비밀번호는 AppError → False)
        - 확인된 회원이어도 role 이 ADMIN 이 아니면 False (일반 회원은 관리자 화면에 못 들어옴)
        - 성공하면 세션 쿠키에 admin_user_id 만 저장
          (SQLAdmin 이 서명해서 보관, API 의 JWT 와는 별개)
        - 실패 이유는 알려 주지 않음 — 화면에는 같은 "잘못됨" 한 가지로만 나옴
        - DB 세션은 이 함수가 직접 열고 닫음 (SQLAdmin 이 FastAPI 의 Depends 를 쓰지 않으므로)
        """
        form = await request.form()
        email = str(form.get("username") or "")
        password = str(form.get("password") or "")
        db = SessionLocal()
        try:
            user = auth_service.authenticate(db, email, password)
            if user.role != UserRole.ADMIN:
                return False
            request.session.update({"admin_user_id": user.user_id})
            return True
        except AppError:
            return False
        finally:
            db.close()

    async def logout(self, request: Request) -> bool:
        """로그아웃 — 세션을 비움.

        (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
        - 로그인하지 않은 상태에서 불러도 오류 없이 True (세션이 이미 비어 있을 뿐)
        """
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        """/admin 의 모든 요청마다 호출 — 지금 이 요청이 로그인한 관리자의 것인지.

        (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
        - 세션에 admin_user_id 가 없으면 False
        - 있어도 **매번 DB 에서 다시 확인**: 아직 ACTIVE 이고 role 이 ADMIN 이어야 True
          (로그인한 뒤에 정지 · 탈퇴 · 권한 회수된 계정이 쿠키만으로 계속 들어오는 것을 막음)
        - 더 이상 안 되는 계정이면 남은 세션도 비움
        - 확인은 일반 API 와 같은 auth_service.get_active_user (정지 · 탈퇴 → AppError)
        """
        user_id = request.session.get("admin_user_id")
        if user_id is None:
            return False
        db = SessionLocal()
        try:
            user = auth_service.get_active_user(db, user_id)
            if user.role == UserRole.ADMIN:
                return True
        except AppError:
            pass
        finally:
            db.close()
        request.session.clear()
        return False


class DevNoteAdmin(ModelView, model=DevNote):
    """공지 작성·수정·공개 (FR-114·115)

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 목록: 번호, 제목, 공개 여부, 공개 시각, 만든 시각. 번호 큰 것(최근)이 위, 제목으로 검색
    - 폼: 제목, 요약, 본문, 공개 여부, 공개 시각 다섯 칸만 (작성자 · 만든 시각 · 고친 시각 ·
      삭제 시각은 폼에 없음)
    - 저장할 때(on_model_change): 새 공지의 작성자는 로그인한 관리자로 자동,
      공개로 바꿨는데 공개 시각이 비어 있으면 지금 시각 (UTC)
    - 지운(deleted_at) 공지는 목록 · 상세 · 수정에서 보이지 않음
    - 삭제 버튼(delete_model)은 행을 지우지 않고 deleted_at 에 지금 시각을 넣음 (소프트 삭제, 89)
    """

    name = "Dev note"
    name_plural = "Dev notes"

    column_list = [
        DevNote.note_id,
        DevNote.title,
        DevNote.is_published,
        DevNote.published_at,
        DevNote.created_at,
    ]
    column_default_sort = [("note_id", True)]
    column_searchable_list = [DevNote.title]
    form_columns = [
        DevNote.title,
        DevNote.summary,
        DevNote.content,
        DevNote.is_published,
        DevNote.published_at,
    ]
    # 본문(MEDIUMTEXT)은 SQLAdmin 이 한 줄 입력창으로 만들므로 여러 줄 입력칸으로 바꿈 (Markdown 용)
    form_overrides = {"content": TextAreaField}

    def list_query(self, request: Request):
        return super().list_query(request).where(DevNote.deleted_at.is_(None))

    def count_query(self, request: Request):
        return super().count_query(request).where(DevNote.deleted_at.is_(None))

    def form_details_query(self, request: Request):
        return super().form_details_query(request).where(DevNote.deleted_at.is_(None))

    def form_edit_query(self, request: Request):
        return super().form_edit_query(request).where(DevNote.deleted_at.is_(None))

    async def on_model_change(self, data: dict, model: DevNote, is_created: bool, request: Request):
        # SQLAdmin 은 이 함수가 끝난 뒤 data 의 값을 모델에 넣으므로, 모델이 아니라 data 를 고침
        if is_created:
            data["author_id"] = request.session.get("admin_user_id")
        if data.get("is_published") and not data.get("published_at"):
            data["published_at"] = datetime.now(UTC).replace(tzinfo=None)

    async def delete_model(self, request: Request, pk) -> None:
        """삭제 버튼 → 행을 지우지 않고 deleted_at 만 채움 (소프트 삭제, DB.md 규칙).

        (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
        - 이미 지운 공지(또는 없는 번호)는 아무것도 바꾸지 않음 — 처음 지운 시각이 남음
        - 목록 · 상세 · 수정 쿼리가 deleted_at 이 있는 공지를 숨기므로 화면에서는 사라짐
        - 메인 페이지 공지 API(83 · 84)도 deleted_at 이 있으면 안 보임
        - 지운 공지는 DB 에서 deleted_at 을 비우면 되살릴 수 있음
        """
        await run_in_threadpool(self._soft_delete, pk)

    def _soft_delete(self, pk) -> None:
        with self.session_maker() as session:
            note = session.get(DevNote, int(pk))
            if note is not None and note.deleted_at is None:
                note.deleted_at = datetime.now(UTC).replace(tzinfo=None)
                session.commit()


class InquiryAdmin(ModelView, model=Inquiry):
    """문의 확인·답변 (FR-115)

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 새로 만들 수 없음 (문의는 메인 페이지 Contact 폼으로만 들어옴), 삭제 버튼도 없음
      (오래된 문의는 보관 기간이 지나면 정리 작업 purge_old_inquiries 가 지움)
    - 목록: 번호, 이메일, 제목, 상태, 받은 시각. 최근 것이 위, 이메일 · 제목으로 검색
    - 상세에서 이름 · 이메일 · 제목 · 본문 · 개인정보 동의 시각까지 모두 볼 수 있음
    - 수정 폼은 답변(answer)과 상태(status) 두 칸만
    - 저장할 때(on_model_change): 답변이 새로 쓰였거나 바뀌면 answered_at = 지금 (UTC),
      상태가 아직 RECEIVED 면 ANSWERED 로. 답변을 비우면 answered_at 도 비움
    - 답변을 이메일로 보내지는 않음 (메일 발송은 아직 없음 — 답변은 이 화면에만 기록)
    """

    name = "Inquiry"
    name_plural = "Inquiries"

    can_create = False
    can_delete = False
    column_list = [
        Inquiry.inquiry_id,
        Inquiry.email,
        Inquiry.title,
        Inquiry.status,
        Inquiry.created_at,
    ]
    column_default_sort = [("inquiry_id", True)]
    column_searchable_list = [Inquiry.email, Inquiry.title]
    form_columns = [Inquiry.answer, Inquiry.status]

    async def on_model_change(
        self, data: dict, model: Inquiry, is_created: bool, request: Request
    ) -> None:
        # data 는 SQLAdmin 이 이 함수 뒤에 모델에 넣는 폼 값. model 은 저장돼 있던 문의 그대로
        answer = (data.get("answer") or "").strip()
        if not answer:
            data["answered_at"] = None
        elif answer != (model.answer or "").strip():
            data["answered_at"] = datetime.now(UTC).replace(tzinfo=None)
            if str(getattr(data.get("status"), "value", data.get("status"))) == "RECEIVED":
                data["status"] = InquiryStatus.ANSWERED


def enum_text(value) -> str:
    """폼 값이 열거형이든 평범한 글자든 같은 글자("ADMIN" 등)로 읽는다."""
    return str(getattr(value, "value", value))


class UserAdmin(ModelView, model=User):
    """회원 보기 (읽기 위주)

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 새로 만들기 · 삭제 없음 (가입은 join 화면, 탈퇴는 회원 본인이 함)
    - 목록: 번호, 이메일, 닉네임, 역할, 상태, 마지막 로그인, 가입일. 최근 가입이 위,
      이메일 · 닉네임으로 검색
    - **password_hash 는 목록 · 상세 · 폼 · 내보내기(CSV) 어디에도 나오지 않음**
    - 수정 폼은 역할(role)과 상태(status) 두 칸만 — 정지(SUSPENDED) 처리와 관리자 지정용
    - 저장할 때(on_model_change) 두 가지를 막음 (오류 문구가 화면에 나옴):
      · 상태를 탈퇴(DELETED)로 바꾸기 — 탈퇴는 회원 본인의 탈퇴 절차(이메일 해제 · 보관)로만
      · 로그인한 관리자가 자기 자신을 관리자에서 내리거나 정지하기 —
        아무도 못 들어오게 되는 것을 막음
    """

    name = "User"
    name_plural = "Users"

    can_create = False
    can_delete = False
    column_list = [
        User.user_id,
        User.email,
        User.nickname,
        User.role,
        User.status,
        User.last_login_at,
        User.created_at,
    ]
    column_default_sort = [("user_id", True)]
    column_searchable_list = [User.email, User.nickname]
    column_details_exclude_list = [User.password_hash]
    column_export_exclude_list = [User.password_hash]  # CSV 내보내기에도 넣지 않음
    form_columns = [User.role, User.status]

    async def on_model_change(self, data: dict, model: User, is_created: bool, request: Request):
        status = enum_text(data.get("status", model.status))
        role = enum_text(data.get("role", model.role))
        if status == UserStatus.DELETED and model.status != UserStatus.DELETED:
            raise ValueError("Use the member's own withdrawal instead of setting DELETED here.")
        if model.user_id is not None and model.user_id == request.session.get("admin_user_id"):
            if role != UserRole.ADMIN or status != UserStatus.ACTIVE:
                raise ValueError("You cannot demote or suspend your own account.")


def setup_admin(app: FastAPI) -> Admin:
    """main.py 에서 한 번 호출. 관리자 화면(SQLAdmin)을 붙인다.

    (구현: AI — 2026-10-13, P1-21, 함수 하나씩 검토)
    - 주소는 설정 admin_path (기본 /admin). 배포 때 .env 의 ADMIN_PATH 로 추측하기 어려운 값으로
      바꿈 (2026-10-13 결정). 잘못된 값("/", "/api…", "/" 로 시작하지 않음)은 서버가 켜질 때 오류
    - 로그인은 AdminAuth (ADMIN 계정만, 세션 쿠키 서명은 jwt_secret)
    - 화면 셋: 공지(DevNoteAdmin), 문의(InquiryAdmin), 회원(UserAdmin)
    - 이 함수는 프론트 정적 파일 마운트("/")보다 먼저 불러야 함 (main.py 가 그렇게 함)
    - IP 제한은 두지 않음 — 앞단(Nginx 등)에서 걸 일이며, 배포 때 정함
    """
    settings = get_settings()
    path = settings.admin_path
    if (
        not path.startswith("/")
        or len(path) < 2
        or path.rstrip("/").startswith(settings.api_prefix)
    ):
        raise ValueError(f"ADMIN_PATH is not usable: {path!r}")
    admin = Admin(
        app,
        engine,
        base_url=path.rstrip("/"),
        authentication_backend=AdminAuth(secret_key=settings.jwt_secret),
        title="Studio Nx Admin",
    )
    admin.add_view(DevNoteAdmin)
    admin.add_view(InquiryAdmin)
    admin.add_view(UserAdmin)
    return admin
