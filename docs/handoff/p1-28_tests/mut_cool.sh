#!/bin/bash
cd /c/Users/USER/Desktop/myProject/StudioNx/studionx/frontend
F=static/js/core/recover.js
B=/c/Users/USER/.claude/jobs/13ed74eb/tmp/rec8.bak
cp $F $B
cd /c/Users/USER/AppData/Local/Temp/p124
mut() {
  python -I -c "
import sys
p=r'C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F'
t=open(p,encoding='utf-8').read()
a=sys.argv[1]; b=sys.argv[2]
assert a in t, a
open(p,'w',encoding='utf-8').write(t.replace(a,b,1))" "$2" "$3"
  echo "$1: $(timeout 280 node cool.mjs 2>&1 | tail -1)"
  cp $B C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F
}
mut "M1 풀어 주기 제거" "      button.disabled = false;   // stop 은 잠그므로 끝난 뒤에 풀음" "      void button;"
mut "M2 끝나도 타이머 안 정리" "    if (left <= 0) {
      stopResendCooldown(modal);" "    if (left <= 0) {
      note.textContent = '';"
mut "M3 다시 시작 때 이전 타이머 안 끊음" "  stopResendCooldown(modal);
  const endAt" "  const endAt"
mut "M4 횟수로 셈(시계 무시)" "const left = Math.ceil((endAt - Date.now()) / 1000);" "modal.recoverLeft = (modal.recoverLeft === undefined ? Math.ceil(total) : modal.recoverLeft) - 1; const left = modal.recoverLeft + 1;"
mut "M5 올림 대신 버림" "Math.ceil((endAt - Date.now()) / 1000)" "Math.floor((endAt - Date.now()) / 1000)"
mut "M6 stop 이 버튼을 안 잠금" "  button.disabled = true;
  return true;
}

/**
 * \"send again\" 을 잠그고" "  return true;
}

/**
 * \"send again\" 을 잠그고"
mut "M7 stop 이 글자를 안 지움" "  if (note) note.textContent = '';
  if (!button) return false;" "  if (!button) return false;"
mut "M8 stop 이 타이머를 안 끊음" "    window.clearInterval(modal.recoverTimer);
    modal.recoverTimer = null;" "    modal.recoverTimer = null;"
mut "M9 시간 검사 제거" "if (!modal || typeof total !== 'number' || !isFinite(total) || total <= 0) return false;" "if (!modal) return false;"
mut "M10 기본값 제거" "const total = seconds === undefined ? RESEND_COOLDOWN_SECONDS : seconds;" "const total = seconds;"
mut "M11 시작 때 잠그지 않음" "  button.disabled = true;
  render();" "  render();"
mut "M12 글자 형식 변경" "'(available in ' + left + 's)'" "'(' + left + 's)'"
cmp -s $B C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F && echo "restored: 원본과 같음" || echo "restored: 다름!"
echo "FINAL: $(timeout 280 node cool.mjs 2>&1 | tail -1)"
