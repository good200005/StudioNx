# frames/<콘셉트>/ 프레임 → 콘셉트마다 GIF + 스토리보드 PNG (Pillow 필요). render.mjs 다음에 실행
import glob, os
from PIL import Image, ImageDraw, ImageFont
font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 22)
fsm = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 16)
info = {
 'A': ('count_in', 'A · Count-in (카운트인)', '1·2·3·4 (240 BPM, 한 박 250ms) → 4에서 화면이 위로 걷히며 첫 화면 등장', [120,360,600,800,880,1200,1900]),
 'B': ('signal_in', 'B · Signal in (신호 들어옴)', '평평한 선 → 맥박처럼 튐(빨강 → 보라) → 선을 따라 위아래로 열림 (오류 페이지와 같은 언어)', [80,320,520,680,800,1100,1800]),
 'C': ('crescent', 'C · Crescent (초승달 + 레벨 미터)', '초승달이 그려지고 채워짐 → 레벨 미터가 0dB까지 → 살짝 커지며 사라짐', [160,360,560,760,880,1200,1900]),
}
OUT = '..'   # docs/page_mockups/loader
for f in glob.glob(OUT+'/0*'): os.remove(f)
for i,(k,(slug,title,desc,picks)) in enumerate(info.items(), 1):
    ms = {int(f.rsplit('_',1)[1][:-4]): f for f in glob.glob(f'frames/{k}/*.png')}
    keys = sorted(ms)
    frames = [Image.open(ms[m]).convert('RGB').resize((540,338), Image.LANCZOS) for m in keys]
    hold = Image.new('RGB',(540,338),(11,10,15))   # 반복 전 잠깐 검은 화면 = 새로 접속
    seq = [hold] + frames
    pal = [f.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for f in seq]
    pal[0].save(f'{OUT}/{i:02d}_{k}_{slug}.gif', save_all=True, append_images=pal[1:], duration=[400]+[40]*(len(frames)-1)+[1500], loop=0)
    tw, th = 360, 225
    sb = Image.new('RGB', (tw*4+50, 90 + (th+40)*2), (11,10,15)); d = ImageDraw.Draw(sb)
    d.text((14,14), title, font=font, fill=(244,243,247)); d.text((14,50), desc, font=fsm, fill=(185,182,196))
    for j,p in enumerate(picks):
        near = min(keys, key=lambda x: abs(x-p))
        im = Image.open(ms[near]).convert('RGB').resize((tw,th), Image.LANCZOS)
        x = 10 + (j%4)*(tw+10); y = 90 + (j//4)*(th+40)
        sb.paste(im,(x,y)); d.rectangle([x,y,x+tw-1,y+th-1], outline=(70,66,79))
        tag = '  (최종 첫 화면)' if j == len(picks)-1 else '  (첫 화면 등장 중)' if j >= 4 else ''
        d.text((x, y+th+6), f'{near} ms{tag}', font=fsm, fill=(163,131,255))
    sb.save(f'{OUT}/{i:02d}_{k}_{slug}_storyboard.png')
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(f'{OUT}/{f}')//1024, 'KB')
