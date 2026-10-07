// 비밀번호 규칙 — 가입(join.js, P1-07 16 · 17)과 비밀번호 변경(userinfo.js, P1-10 25)이 함께 씀
// 서버(P1-04 14 check_password_rules)도 같은 규칙으로 다시 검사
// (2026-10-08 join.js 에서 옮김 — 다른 페이지가 join.js 를 import 하면 그 페이지 코드까지 실행되므로)

/** 비밀번호 조건 (PRD 01 FR-102) */
export const PASSWORD_RULES = {
  length: (pw) => pw.length >= 8 && pw.length <= 20,
  upper: (pw) => /[A-Z]/.test(pw),
  lower: (pw) => /[a-z]/.test(pw),
  number: (pw) => /[0-9]/.test(pw),
  special: (pw) => /[!-/:-@[-`{-~]/.test(pw), // 키보드 기호 (ASCII 33~126 중 영문·숫자 제외: !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~)
};

/** 쓸 수 있는 문자: 영문·숫자·키보드 기호만 (한글·공백·이모지 등 불가) */
export const PASSWORD_ALLOWED = /^[!-~]*$/;
