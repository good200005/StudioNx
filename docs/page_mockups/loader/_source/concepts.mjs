// 로딩(인트로) 콘셉트 3종 — home.html 위에 덮는 오버레이. hero: 첫 화면 등장 애니메이션을 시작할 시각(ms)
const base = `
.ldr { position: fixed; inset: 0; z-index: 9999; background: #0b0a0f; color: #f4f3f7; overflow: hidden;
       font-family: Unbounded, sans-serif; display: grid; place-items: center; }
.ldr__tag { position: absolute; left: 50%; transform: translateX(-50%); font: 700 12px/1 "Pretendard Variable", "Malgun Gothic", sans-serif;
            letter-spacing: .24em; color: #7f7b8c; text-transform: uppercase; white-space: nowrap; }
`;

export const concepts = {
  A: {
    title: 'A · Count-in (카운트인)',
    desc: '녹음 전 메트로놈 카운트인처럼 1·2·3·4 (240 BPM = 한 박 250ms). 4에서 화면이 위로 걷히며 첫 화면 등장',
    hero: 750, total: 1950,
    css: base + `
.ldr { animation: lift 250ms cubic-bezier(.7,0,.3,1) 750ms both; }
@keyframes lift { to { transform: translateY(-100%); } }
.ldr__num { position: relative; width: 1em; height: 1em; font: 800 220px/1 Unbounded, sans-serif; }
.ldr__num span { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; animation: beat 250ms linear forwards; }
.ldr__num span:nth-child(1) { animation-delay: 0ms; }
.ldr__num span:nth-child(2) { animation-delay: 250ms; }
.ldr__num span:nth-child(3) { animation-delay: 500ms; }
.ldr__num span:nth-child(4) { animation-delay: 750ms; color: #6a24f6; }
@keyframes beat { 0%,99.9% { opacity: 1; } 100% { opacity: 0; } }
.ldr__num span:nth-child(4) { animation-name: beat4; animation-duration: 250ms; animation-fill-mode: forwards; }
@keyframes beat4 { 0%,100% { opacity: 1; } }
.ldr__dots { position: absolute; top: calc(50% + 150px); left: 50%; transform: translateX(-50%); display: flex; gap: 18px; }
.ldr__dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #46424f; animation: dot 1ms linear both; }
.ldr__dots i:nth-child(1) { animation-delay: 0ms; } .ldr__dots i:nth-child(2) { animation-delay: 250ms; }
.ldr__dots i:nth-child(3) { animation-delay: 500ms; } .ldr__dots i:nth-child(4) { animation-delay: 750ms; }
@keyframes dot { to { background: #a383ff; border-color: #a383ff; } }
.ldr__tag { top: calc(50% + 200px); }
`,
    html: `<div class="ldr"><div class="ldr__num"><span>1</span><span>2</span><span>3</span><span>4</span></div>
      <div class="ldr__dots"><i></i><i></i><i></i><i></i></div><p class="ldr__tag">Count-in · 240 BPM</p></div>`,
  },

  B: {
    title: 'B · Signal in (신호 들어옴)',
    desc: '오류 페이지의 "평평한 선"이 맥박처럼 튀며 신호가 들어오고, 그 선을 따라 화면이 위아래로 열림 (오류 페이지와 같은 언어)',
    hero: 650, total: 1850,
    css: base + `
.ldr { background: none; }
.ldr__half { position: absolute; left: 0; right: 0; height: 50%; background: #0b0a0f; }
.ldr__half--top { top: 0; animation: open-up 350ms cubic-bezier(.7,0,.3,1) 650ms both; }
.ldr__half--bot { bottom: 0; animation: open-down 350ms cubic-bezier(.7,0,.3,1) 650ms both; }
@keyframes open-up { to { transform: translateY(-100%); } }
@keyframes open-down { to { transform: translateY(100%); } }
.ldr__line { position: absolute; left: 0; top: calc(50% - 60px); width: 100%; height: 120px; overflow: visible; }
.ldr__line path { fill: none; stroke: #a383ff; stroke-width: 3; vector-effect: non-scaling-stroke;
                  stroke-dasharray: 3000; stroke-dashoffset: 3000; animation: draw 450ms cubic-bezier(.3,0,.2,1) 100ms both, gone 150ms linear 650ms both; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes gone { to { opacity: 0; } }
.ldr__tag { top: calc(50% + 70px); animation: gone 150ms linear 650ms both; }
.ldr__tag b { font-weight: 700; }
.ldr__tag .sw { display: inline-grid; } .ldr__tag .sw b { grid-area: 1 / 1; text-align: left; }
.ldr__tag .no { color: #ff6b6b; animation: hide 1ms linear 450ms both; }
.ldr__tag .yes { color: #a383ff; opacity: 0; animation: show 1ms linear 450ms both; }
@keyframes hide { to { opacity: 0; } }
@keyframes show { to { opacity: 1; } }
.ldr__brand { position: absolute; top: calc(50% - 130px); left: 50%; transform: translateX(-50%); font: 800 28px/1 Unbounded, sans-serif; letter-spacing: -.01em;
              opacity: 0; animation: fadein 250ms ease-out 300ms both, gone 150ms linear 650ms both; }
@keyframes fadein { to { opacity: 1; } }
`,
    html: `<div class="ldr"><div class="ldr__half ldr__half--top"></div><div class="ldr__half ldr__half--bot"></div>
      <svg class="ldr__line" viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0,60 H640 L670,60 L690,10 L715,110 L740,30 L760,75 L780,60 H1440"/></svg>
      <p class="ldr__brand">Studio Nx</p><p class="ldr__tag">Input · <span class="sw"><b class="no">No signal</b><b class="yes">Signal in</b></span></p></div>`,
  },

  C: {
    title: 'C · Crescent (초승달 + 레벨 미터)',
    desc: 'Nyxi의 초승달 로고가 선으로 그려지고 채워짐 → 아래 레벨 미터가 0dB까지 차오르면 화면이 살짝 커지며 사라짐',
    hero: 800, total: 1950,
    css: base + `
.ldr { animation: out 220ms ease-in 800ms both; }
@keyframes out { to { opacity: 0; transform: scale(1.06); } }
.ldr__wrap { display: grid; justify-items: center; gap: 22px; }
.ldr__moon { width: 120px; height: 120px; }
.ldr__moon path { stroke: #a383ff; stroke-width: .8; fill: #6a24f6; fill-opacity: 0; stroke-dasharray: 100; stroke-dashoffset: 100;
                  animation: draw 400ms cubic-bezier(.3,0,.2,1) both, fill 180ms ease-out 380ms both; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes fill { to { fill-opacity: 1; } }
.ldr__name { font: 800 34px/1 Unbounded, sans-serif; clip-path: inset(0 100% 0 0); animation: wipe 300ms cubic-bezier(.3,0,.2,1) 300ms both; }
@keyframes wipe { to { clip-path: inset(0); } }
.ldr__meter { display: flex; gap: 4px; height: 10px; }
.ldr__meter i { width: 14px; background: #24212e; animation: lit 1ms linear both; }
${Array.from({ length: 16 }, (_, i) => `.ldr__meter i:nth-child(${i + 1}) { animation-delay: ${380 + i * 25}ms; ${i >= 13 ? '--lit:#ffd166;' : ''}${i >= 15 ? '--lit:#ff6b6b;' : ''} }`).join('\n')}
@keyframes lit { to { background: var(--lit, #a383ff); } }
.ldr__tag { position: static; transform: none; }
`,
    html: `<div class="ldr"><div class="ldr__wrap">
      <svg class="ldr__moon" viewBox="0 0 32 32"><path pathLength="100" d="M20.6 3.2A13 13 0 1 0 28.8 22 10.5 10.5 0 1 1 20.6 3.2Z"/></svg>
      <p class="ldr__name">Studio Nx</p><div class="ldr__meter">${'<i></i>'.repeat(16)}</div><p class="ldr__tag">Warming up · 0 dB</p></div></div>`,
  },
};
