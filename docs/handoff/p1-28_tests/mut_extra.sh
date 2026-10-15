#!/bin/bash
cd /c/Users/USER/Desktop/myProject/StudioNx/studionx/frontend
F=static/js/core/recover.js
B=/c/Users/USER/.claude/jobs/13ed74eb/tmp/rec9.bak
cmp -s $B $F || { echo "시작 전 recover.js 가 원본과 다름: 중단"; exit 1; }
cd /c/Users/USER/AppData/Local/Temp/p124
mut() {
  python -I -c "
import sys
p=r'C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F'
t=open(p,encoding='utf-8').read()
a=sys.argv[1]; b=sys.argv[2]
assert a in t, a
open(p,'w',encoding='utf-8').write(t.replace(a,b,1))" "$2" "$3"
  echo "$1: extra=[$(timeout 200 node resend_extra.mjs 2>&1 | tail -1)]"
  cp $B C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F
}
mut "M1 recoverLast 없을 때도 진행" "    if (!last || button.getAttribute('data-busy') === 'true') return;" "    if (button.getAttribute('data-busy') === 'true') return;"
mut "M2 busy 검사 제거" "    if (!last || button.getAttribute('data-busy') === 'true') return;" "    if (!last) return;"
mut "M12 reset 이 recoverLast 를 안 지움" "  modal.recoverLast = null;   // 마지막으로 보낸 이메일도 남기지 않음
" ""
mut "M16 폼 finally 가 항상 풂" "        if ((modal.recoverEpoch || 0) === epoch) {   // 옛 요청의 끝이 새 요청의 잠금을 풀지 않게" "        if (true) {"
cmp -s $B C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F && echo "restored: 원본과 같음" || echo "restored: 다름!"
echo "FINAL: extra=[$(timeout 200 node resend_extra.mjs 2>&1 | tail -1)]"
