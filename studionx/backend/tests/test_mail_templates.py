"""메일 문안 (services/mail_templates.py, P1-28 FR-119)."""

import re
from html.parser import HTMLParser

import pytest

from app.services.mail_templates import MailMessage, build_email_reminder_message

BASE = "http://localhost:8000"


def build(email="you@example.com", base=BASE):
    return build_email_reminder_message(email, base)


def test_returns_a_message_with_subject_text_and_html():
    msg = build()
    assert isinstance(msg, MailMessage)
    assert msg.subject == "Here's the email you signed up with"
    assert msg.text and msg.html


def test_contains_the_login_email_in_both_versions():
    msg = build("you@example.com")
    assert "you@example.com" in msg.text
    assert "you@example.com" in msg.html


def test_links_point_to_login_recover_and_contact_on_the_site():
    msg = build()
    for path in ("home.html#login", "home.html#recover", "home.html#contact"):
        assert f"{BASE}/{path}" in msg.html
        assert f"{BASE}/{path}" in msg.text


def test_trailing_slash_in_base_url_does_not_double_up():
    msg = build(base="http://localhost:8000/")
    assert "8000//home.html" not in msg.html + msg.text
    assert "http://localhost:8000/home.html#login" in msg.html


def test_no_token_password_or_personal_details_are_included():
    msg = build()
    body = (msg.text + msg.html).lower()
    for forbidden in ("#token=", "?token=", "nickname", "joined", "project", "your password is"):
        assert forbidden not in body


def test_email_is_escaped_in_html_but_not_in_text():
    evil = 'a"><script>alert(1)</script>@example.com'
    msg = build(evil)
    assert "<script>" not in msg.html  # 마크업으로 해석되지 않음
    assert "&lt;script&gt;" in msg.html
    assert evil in msg.text  # 글자판은 그대로


def test_ampersand_in_email_is_escaped():
    assert "a&amp;b@example.com" in build("a&b@example.com").html


def test_urls_in_attributes_are_escaped():
    msg = build(base='http://x.example/"onmouseover="alert(1)')
    assert '"onmouseover="' not in msg.html  # 속성 밖으로 빠져나오지 못함


def test_uses_the_dark_card_colors_of_the_site():
    html = build().html
    for color in ("#0b0a0f", "#2a2836", "#6a24f6", "#a78bfa", "#ffffff"):
        assert color in html


def test_all_styles_are_inline_and_no_external_resources():
    html = build().html
    assert "<style" not in html  # 메일 프로그램은 <style> 을 지우는 일이 많음
    assert "<link" not in html
    assert "<script" not in html
    external = re.search(r"""(src|href)=["']https?://(?!localhost)""", html)
    assert external is None  # 외부 이미지, 파일 없음
    assert "<img" not in html


def test_html_is_well_formed():
    class Checker(HTMLParser):
        def __init__(self):
            super().__init__()
            self.stack, self.errors = [], []
            self.void = {"br", "img", "meta", "link"}

        def handle_starttag(self, tag, attrs):
            if tag not in self.void:
                self.stack.append(tag)

        def handle_endtag(self, tag):
            if not self.stack or self.stack[-1] != tag:
                self.errors.append(tag)
            else:
                self.stack.pop()

    checker = Checker()
    checker.feed(build().html)
    assert checker.errors == []
    assert checker.stack == []  # 열린 채로 남은 태그가 없음


@pytest.mark.parametrize("label", ["Sign in", "Reset password", "Contact us", "Good to know"])
def test_has_the_pieces_chosen_in_the_mockup(label):
    assert label in build().html


def test_has_both_buttons_and_the_reassurance_line():
    msg = build()
    assert "Didn't ask for this? Ignore it, nothing changed." in msg.text
    assert "Didn't ask for this? Ignore it, nothing changed." in msg.html
    assert "can't be changed" in msg.html
    assert "never contains your password" in msg.html
