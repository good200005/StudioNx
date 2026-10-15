"""메일 문안 (P1-28, FR-119) — 보내는 일(전송)과 분리해서 문안만 만든다.

모양은 사용자가 고른 C안(도움말을 곁들인 안내)에 B안의 어두운 카드 색을 입힌 것이다
(docs/page_mockups/account_recovery/mock_email.png).
메일 프로그램마다 스타일 지원이 달라서 모든 스타일을 태그에 직접 쓰고(인라인),
같은 내용의 글자판(text)도 함께 만든다.
"""

from dataclasses import dataclass
from html import escape

# 사이트 색 (tokens.css) — 메일은 CSS 변수를 못 쓰므로 값을 그대로 쓴다
BG = "#0b0a0f"
CARD_BORDER = "#2a2836"
INK = "#ffffff"
INK_SOFT = "#b9b6c4"
INK_FAINT = "#8a8896"
VIOLET = "#6a24f6"
VIOLET_LIGHT = "#a78bfa"

FONT = "Arial,Helvetica,sans-serif"


@dataclass(frozen=True)
class MailMessage:
    """보낼 메일 한 통의 문안 (제목, 글자판, HTML)."""

    subject: str
    text: str
    html: str


def build_email_reminder_message(email: str, base_url: str) -> MailMessage:
    """"가입한 이메일이 무엇인지" 알려 주는 메일 문안 (FR-119). 가입된 `ACTIVE` 계정에만 보낸다.

    - 담는 것: 로그인 이메일, 로그인 버튼, 비밀번호 재설정 버튼, 알아 둘 점 두 가지,
      무시해도 된다는 안내, 문의 링크
    - 담지 않는 것: 닉네임, 가입일, 프로젝트 이름(메일함이 남에게 열려 있을 수 있음), 비밀번호, 토큰
    - 링크는 사이트 주소(`base_url`)의 `home.html#login`(로그인 모달),
      `home.html#recover`(복구 화면), `home.html#contact`(문의)를 가리킨다.
      끝의 `/`가 있어도 겹치지 않는다
    - 이메일은 HTML 에 넣기 전에 이스케이프한다 (`<`, `&`, `"` 등이 마크업으로 해석되지 않게)
    """
    base = base_url.rstrip("/")
    login_url = f"{base}/home.html#login"
    recover_url = f"{base}/home.html#recover"
    contact_url = f"{base}/home.html#contact"
    shown = escape(email, quote=True)

    subject = "Here's the email you signed up with"
    text = (
        "Studio Nx\n\n"
        "Here's the email you signed up with\n\n"
        "Your Studio Nx account uses this address to sign in:\n"
        f"  {email}\n\n"
        f"Sign in: {login_url}\n"
        f"Reset password: {recover_url}\n\n"
        "Good to know\n"
        "- Your sign-in email can't be changed.\n"
        "- This email never contains your password.\n\n"
        "Didn't ask for this? Ignore it, nothing changed.\n"
        f"Need help? Contact us: {contact_url}\n"
    )
    button = (
        f"display:inline-block;padding:13px 22px;background:{VIOLET};color:#ffffff;"
        f"text-decoration:none;font:700 14px/1 {FONT};letter-spacing:.04em"
    )
    button_outline = (
        f"display:inline-block;padding:12px 21px;border:1px solid {VIOLET_LIGHT};"
        f"color:{VIOLET_LIGHT};"
        f"text-decoration:none;font:700 14px/1 {FONT};letter-spacing:.04em"
    )
    html = (
        f'<div style="margin:0;padding:24px 12px;background:#16151c">'
        f'<div style="max-width:520px;margin:0 auto;background:{BG};padding:36px;'
        f'font:15px/1.7 {FONT};color:{INK_SOFT}">'
        f'<div style="margin:0 0 26px;font:800 18px/1 {FONT};color:{INK};letter-spacing:.02em">'
        f'<span style="color:{VIOLET_LIGHT}">&#9790;</span>&nbsp; Studio Nx</div>'
        f'<h1 style="margin:0 0 12px;font:800 22px/1.3 {FONT};color:{INK}">'
        f"Here's the email you signed up with</h1>"
        f'<p style="margin:0 0 18px;color:{INK_SOFT}">'
        f"Your Studio Nx account uses this address to sign in:</p>"
        f'<p style="margin:0 0 24px;padding:16px 18px;border:1px solid {CARD_BORDER};'
        f'font:700 16px/1.4 {FONT};color:{INK}">{shown}</p>'
        f'<p style="margin:0 0 26px">'
        f'<a href="{escape(login_url, quote=True)}" style="{button}">Sign in</a>&nbsp;&nbsp;'
        f'<a href="{escape(recover_url, quote=True)}" style="{button_outline}">'
        f"Reset password</a></p>"
        f'<p style="margin:0 0 6px;font:700 13px/1.4 {FONT};color:{INK}">Good to know</p>'
        f'<ul style="margin:0 0 26px;padding-left:18px;font:14px/1.7 {FONT};color:{INK_SOFT}">'
        f"<li>Your sign-in email can't be changed.</li>"
        f"<li>This email never contains your password.</li></ul>"
        f'<p style="margin:0;border-top:1px solid {CARD_BORDER};padding-top:16px;'
        f'font:12px/1.6 {FONT};color:{INK_FAINT}">'
        f"Didn't ask for this? Ignore it, nothing changed. Need help? "
        f'<a href="{escape(contact_url, quote=True)}" style="color:{VIOLET_LIGHT}">'
        f"Contact us</a>.</p>"
        f"</div></div>"
    )
    return MailMessage(subject=subject, text=text, html=html)
