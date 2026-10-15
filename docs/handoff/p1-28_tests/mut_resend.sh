#!/bin/bash
cd /c/Users/USER/Desktop/myProject/StudioNx/studionx/frontend
F=static/js/core/recover.js
B=/c/Users/USER/.claude/jobs/13ed74eb/tmp/rec9.bak
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
  r=$(timeout 280 node resend.mjs 2>&1 | tail -1)
  l=$(timeout 280 node late.mjs 2>&1 | tail -1)
  echo "$1: resend=[$r] late=[$l]"
  cp $B C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F
}
mut "M1 recoverLast 없을 때도 진행" "    if (!last || button.getAttribute('data-busy') === 'true') return;" "    if (button.getAttribute('data-busy') === 'true') return;"
mut "M2 busy 검사 제거" "    if (!last || button.getAttribute('data-busy') === 'true') return;" "    if (!last) return;"
mut "M3 성공 때 새 1분 안 셈" "      startResendCooldown(modal);
    } catch (err) {
      if ((modal.recoverEpoch" "    } catch (err) {
      if ((modal.recoverEpoch"
mut "M4 다시 보냈다는 문장 제거" "      if (detail) detail.textContent = \"We've sent it again. \" + SENT_DETAIL[last.kind];" "      void detail;"
mut "M5 429 에서 서버 시간으로 안 잠금" "      if (wait > 0) startResendCooldown(modal, wait);
      else button.disabled = false;" "      button.disabled = false;"
mut "M6 실패해도 버튼을 안 풀어 줌" "      else button.disabled = false;
    } finally {" "    } finally {"
mut "M7 서버 문구 그대로" "        errorBox.textContent = recoverErrorText(err);
        errorBox.hidden = false;
      }
      const wait" "        errorBox.textContent = err.message;
        errorBox.hidden = false;
      }
      const wait"
mut "M8 새로 누를 때 이전 오류 안 지움" "    button.setAttribute('data-busy', 'true');
    button.disabled = true;
    const epoch = modal.recoverEpoch || 0;
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.hidden = true;
    }" "    button.setAttribute('data-busy', 'true');
    button.disabled = true;
    const epoch = modal.recoverEpoch || 0;"
mut "M9 종류별 주소 무시(항상 재설정)" "    for (const candidate of RECOVER_FORMS) if (candidate.kind === last.kind) spec = candidate;" "    spec = RECOVER_FORMS[0];"
mut "M10 reset 이 타이머를 안 멈춤" "  stopResendCooldown(modal);   // send again 의 기다림도 처음으로 (다음에 보낼 때 새로 셈)
" ""
mut "M11 reset 이 세대를 안 올림" "  modal.recoverEpoch = (modal.recoverEpoch || 0) + 1;" "  void 0;"
mut "M12 reset 이 recoverLast 를 안 지움" "  modal.recoverLast = null;   // 마지막으로 보낸 이메일도 남기지 않음
" ""
mut "M13 reset 이 보내는 중 표시를 안 풂" "  for (const form of recover.querySelectorAll('form')) {
    form.removeAttribute('data-busy');" "  for (const form of recover.querySelectorAll('form')) {
    void form;"
mut "M14 폼의 늦은 성공 응답 안 버림" "        if ((modal.recoverEpoch || 0) !== epoch) return;   // 기다리는 사이 화면을 떠났거나 모달을 닫음: 늦은 응답은 버림
" ""
mut "M15 폼의 늦은 실패 응답 안 버림" "      } catch (err) {
        if ((modal.recoverEpoch || 0) !== epoch) return;
        if (errorBox) {" "      } catch (err) {
        if (errorBox) {"
mut "M16 폼 finally 가 항상 풂" "        if ((modal.recoverEpoch || 0) === epoch) {   // 옛 요청의 끝이 새 요청의 잠금을 풀지 않게" "        if (true) {"
mut "M17 다시 보내기의 늦은 응답 안 버림" "      if ((modal.recoverEpoch || 0) !== epoch) return;   // 기다리는 사이 화면을 떠남: 늦은 응답은 버림
" ""
mut "M18 버튼 없는데 진행" "  const button = modal.querySelector('#recover-resend');
  if (!button) return false;
  const errorBox = modal.querySelector('#recover-resend-error');" "  const button = modal.querySelector('#recover-resend');
  const errorBox = modal.querySelector('#recover-resend-error');"
cmp -s $B C:/Users/USER/Desktop/myProject/StudioNx/studionx/frontend/$F && echo "restored: 원본과 같음" || echo "restored: 다름!"
echo "FINAL: resend=[$(timeout 280 node resend.mjs 2>&1 | tail -1)] late=[$(timeout 280 node late.mjs 2>&1 | tail -1)]"
