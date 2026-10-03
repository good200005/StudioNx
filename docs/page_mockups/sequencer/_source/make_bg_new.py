# 배치안 A(bg.html) → 새 프로젝트 화면(bg_new.html): MASTER 트랙만 + 빈 안내
import pathlib
d = pathlib.Path(__file__).parent
s = (d / 'bg.html').read_text(encoding='utf-8')
s = s.replace('<span class="proj">Midnight Drive</span><span class="saved">저장됨 · 12:04</span>',
              '<span class="proj">Night Bus</span><span class="saved">새 프로젝트 · 저장됨</span>')
s = s.replace('<span class="chip">128.00 BPM</span><span class="chip">4/4</span><span class="chip">A minor</span>',
              '<span class="chip">120.00 BPM</span><span class="chip">4/4</span><span class="chip">키 없음</span>')
s = s.replace('</body>', """<script>
document.querySelectorAll('.trk').forEach(t => { if (!t.textContent.includes('MASTER')) t.remove(); });
document.querySelector('.tracks').insertAdjacentHTML('afterbegin',
  '<div style="margin:18px 18px 10px 268px;border:1px dashed rgb(244 243 247 / .2);padding:44px;text-align:center;color:#7f7b8c;font-size:14px;line-height:1.8">'
  + '<b style="color:#f4f3f7;font-size:16px">빈 프로젝트</b><br>왼쪽 브라우저에서 샘플을 끌어 놓거나, <span style="color:#a383ff">+ 트랙</span>으로 악기 트랙을 추가하세요</div>');
</script></body>""")
(d / 'bg_new.html').write_text(s, encoding='utf-8')
print('ok')
