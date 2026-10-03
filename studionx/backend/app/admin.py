"""관리자 화면 /admin — SQLAdmin (PRD 01 FR-115) — 템플릿: 구현은 직접 (P1-21).

ADMIN 계정(users.role = 'ADMIN')만 들어올 수 있고, 공지 작성·공개와 문의 답변을 함.
main.py 에서 setup_admin(app) 를 **프론트 정적 파일 마운트("/")보다 먼저** 호출해야
/admin 주소가 SiteFiles 에 가려지지 않음.

ADMIN 계정 만들기: 일반 가입 후 DB 에서 직접
    UPDATE users SET role = 'ADMIN' WHERE email = '...';
"""

from fastapi import FastAPI
from sqladmin import ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from app.models import DevNote, Inquiry, User


class AdminAuth(AuthenticationBackend):
    """/admin 로그인 — API 의 JWT 와 따로, SQLAdmin 자체 세션 쿠키를 씀.

    생성: AdminAuth(secret_key=settings.jwt_secret)  (세션 쿠키 서명용)
    """

    async def login(self, request: Request) -> bool:
        """SQLAdmin 로그인 폼 전송.

        TODO(P1-21):
        - form = await request.form() → form["username"](=이메일), form["password"]
        - DB 세션을 직접 열어(SessionLocal()) auth_service.authenticate 로 확인 (P1-05)
          → 실패(AppError)면 return False
        - user.role != 'ADMIN' 이면 return False
        - request.session.update({"admin_user_id": user.user_id}) → return True
        """
        raise NotImplementedError

    async def logout(self, request: Request) -> bool:
        """TODO(P1-21): request.session.clear() → return True"""
        raise NotImplementedError

    async def authenticate(self, request: Request) -> bool:
        """/admin 의 모든 요청마다 호출.

        TODO(P1-21):
        - user_id = request.session.get("admin_user_id") 가 없으면 False
        - (권장) DB 에서 그 사용자가 아직 ADMIN 이고 ACTIVE 인지 다시 확인
        """
        raise NotImplementedError


class DevNoteAdmin(ModelView, model=DevNote):
    """공지 작성·수정·공개 (FR-114·115)

    TODO(P1-21) — 모델 컬럼을 채운 뒤 아래 설정을 정하기:
    - column_list = [DevNote.note_id, DevNote.title, DevNote.is_published, DevNote.published_at]
    - form_excluded_columns = [created_at, updated_at] — author_id 는 저장할 때 로그인한 관리자로
      (async def on_model_change(self, data, model, is_created, request) 에서 채움)
    - 공개로 바꿀 때 published_at 이 비어 있으면 지금 시각으로
    - 삭제 버튼 대신 deleted_at 을 쓰려면 can_delete = False 후 폼에서 처리
    """

    name = "Dev note"
    name_plural = "Dev notes"


class InquiryAdmin(ModelView, model=Inquiry):
    """문의 확인·답변 (FR-115)

    TODO(P1-21):
    - can_create = False (문의는 메인 페이지에서만 들어옴)
    - column_list = [inquiry_id, email, title, status, created_at], 기본 정렬 created_at DESC
    - 수정 폼은 answer, status 만 (form_columns) — 답변 저장 시 answered_at = 지금
    """

    name = "Inquiry"
    name_plural = "Inquiries"


class UserAdmin(ModelView, model=User):
    """회원 보기 (읽기 위주)

    TODO(P1-21):
    - can_create = False, can_delete = False
    - column_exclude_list / form_excluded_columns 에 password_hash (절대 보이지 않게)
    - 수정은 role, status 정도만 (정지 SUSPENDED 처리용)
    """

    name = "User"
    name_plural = "Users"


def setup_admin(app: FastAPI) -> None:
    """main.py 에서 한 번 호출. /admin 에 SQLAdmin 을 붙인다.

    TODO(P1-21):
    - admin = Admin(app, engine, authentication_backend=AdminAuth(secret_key=settings.jwt_secret),
                    title="Studio Nx Admin")     (from sqladmin import Admin, app.db.session engine)
    - admin.add_view(DevNoteAdmin) / InquiryAdmin / UserAdmin
    - 운영(prod)에서 /admin 주소를 바꾸거나 IP 를 제한할지 정하기
    """
    # TODO: 위 내용 구현 (지금은 아무것도 붙이지 않음 — 서버는 그대로 동작)
