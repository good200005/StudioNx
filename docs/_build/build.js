// Studio Nx 문서 빌드 스크립트
//   node docs/_build/build.js          → ERD.png + 모든 PDF 생성
//   node docs/_build/build.js erd      → ERD.png 만
//   node docs/_build/build.js pdf      → PDF 만
//   node docs/_build/build.js pdf Git  → 이름에 'Git'이 들어간 PDF만
// 필요: Node.js, Google Chrome(또는 Edge), 인터넷(CDN: marked, mermaid, viz.js)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { toDot } = require('./erd');

const DOCS = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'studionx-docs-'));
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));

function chrome(args) {
  return execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--user-data-dir=${path.join(TMP, 'profile')}`, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');

// ---------- ERD ----------
function buildErd() {
  const dot = toDot();
  fs.writeFileSync(path.join(__dirname, 'ERD.dot'), dot, 'utf8');
  const html = path.join(TMP, 'erd.html');
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/@viz-js/viz@3/lib/viz-standalone.js"></script>
<body><div id="o"></div><script>
Viz.instance().then(v => { document.getElementById('o').innerHTML = v.renderString(${JSON.stringify(dot)}, { format: 'svg' }).replace(/^[\\s\\S]*?<svg/, '<svg'); });
</script></body>`, 'utf8');
  const dom = chrome(['--virtual-time-budget=15000', '--dump-dom', fileUrl(html)]);
  const m = dom.match(/<svg[\s\S]*<\/svg>/);
  if (!m) throw new Error('ERD SVG 렌더링 실패');
  const svg = m[0];
  const w = Math.ceil(parseFloat(svg.match(/width="([\d.]+)pt"/)[1]) * 4 / 3);
  const h = Math.ceil(parseFloat(svg.match(/height="([\d.]+)pt"/)[1]) * 4 / 3);
  const page = path.join(TMP, 'erd-svg.html');
  fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{display:block}</style>${svg}`, 'utf8');
  chrome(['--hide-scrollbars', `--window-size=${w},${h}`, '--force-device-scale-factor=2',
    `--screenshot=${path.join(DOCS, 'ERD.png')}`, fileUrl(page)]);
  console.log(`ERD.png  ${w * 2}x${h * 2}px`);
}

// ---------- Markdown → PDF ----------
const CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; font-size: 10pt; line-height: 1.55; color: #1a1a1a; }
  h1 { font-size: 19pt; border-bottom: 2px solid #4b3fd6; padding-bottom: 4px; color: #2a2280; }
  h2 { font-size: 14pt; margin-top: 1.4em; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  h3 { font-size: 12pt; } h4 { font-size: 10.5pt; }
  h2, h3, h4 { break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 8.5pt; }
  th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; word-break: break-word; }
  th { background: #eeecff; }
  tr { break-inside: avoid; }
  code { font-family: Consolas, "D2Coding", monospace; font-size: 8.5pt; background: #f3f3f3; padding: 0 2px; }
  pre { background: #f6f6f6; border: 1px solid #ddd; padding: 6px 8px; font-size: 7.5pt; white-space: pre-wrap; word-break: break-all; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #4b3fd6; margin: 6px 0; padding: 2px 10px; color: #444; background: #f8f7ff; }
  img { max-width: 100%; }
  @page landscape { size: A4 landscape; margin: 8mm; }
  .erd-page { page: landscape; break-before: page; break-after: page; text-align: center; }
  .wide-page { page: landscape; break-before: page; break-after: page; }
  .wide-page svg { max-height: 190mm; width: 100%; }
  .erd-page img { width: 100%; max-height: 190mm; object-fit: contain; }
  .doc { break-before: page; }
  .cover { text-align: center; padding-top: 30vh; }
  .cover h1 { border: none; font-size: 30pt; }
  .toc li { margin: 4px 0; }
  .mermaid { text-align: center; break-inside: avoid; }
  .mermaid svg { max-width: 100%; height: auto; }
`;

function buildPdf({ out, title, subtitle, files, base = '' }) {   // base: md 안 이미지·링크의 기준 폴더 (docs 기준)
  const sources = files.map(f => ({ name: f, md: fs.readFileSync(path.join(DOCS, f), 'utf8') }));
  const toc = files.length > 1
    ? `<section class="doc"><h1>목차</h1><ol class="toc">${files.map(f => `<li>${f}</li>`).join('')}</ol></section>` : '';
  const html = path.join(DOCS, '_build', '.tmp_' + path.basename(out, '.pdf') + '.html'); // docs 기준 상대경로(이미지) 유지
  fs.writeFileSync(html, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
<base href="${fileUrl(path.join(DOCS, base))}/">
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>${CSS}</style></head><body>
<section class="cover"><h1>${title}</h1><p style="font-size:14pt">${subtitle}</p><p>${new Date().toISOString().slice(0, 10)}</p></section>
${toc}<div id="out"></div>
<script>
const sources = ${JSON.stringify(sources).replace(/</g, '\\u003c')};
// 범위 표기(FR-231~233)의 ~ 가 취소선으로 바뀌지 않도록 ~~두 개~~ 만 취소선으로 인정
marked.use({ tokenizer: { del(src) {
  const m = /^~~(?=[^\\s~])([\\s\\S]*?[^\\s~])~~(?!~)/.exec(src);
  if (m) return { type: 'del', raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) };
} } });
const out = document.getElementById('out');
let erdShown = false;
for (const s of sources) {
  const sec = document.createElement('section');
  sec.className = 'doc';
  sec.innerHTML = marked.parse(s.md);
  // 첫 열이 짧은 ID(P1-01, FR-101 등)뿐인 표는 첫 열 줄바꿈 금지
  sec.querySelectorAll('table').forEach(t => {
    const cells = [...t.querySelectorAll('tr > :first-child')];
    if (cells.length && cells.every(c => c.textContent.trim().length <= 8)) cells.forEach(c => c.style.whiteSpace = 'nowrap');
  });
  sec.querySelectorAll('img[src$="ERD.png"]').forEach(i => {
    if (erdShown) { const n = document.createElement('em'); n.textContent = '(ERD 그림은 앞의 가로 페이지 참고)'; i.replaceWith(n); return; }
    erdShown = true;
    const d = document.createElement('div'); d.className = 'erd-page'; i.replaceWith(d); d.appendChild(i);
  });
  out.appendChild(sec);
}
document.querySelectorAll('pre code.language-mermaid').forEach(c => {
  const d = document.createElement('div'); d.className = 'mermaid' + (c.textContent.trim().startsWith('gantt') ? ' wide-page' : ''); d.textContent = c.textContent;
  c.parentElement.replaceWith(d);
});
mermaid.initialize({ startOnLoad: false, theme: 'neutral', gantt: { useWidth: 1500, fontSize: 11, barHeight: 13, barGap: 3, topPadding: 40, sectionFontSize: 12 } });
mermaid.run();
</script></body></html>`, 'utf8');
  const target = path.join(DOCS, out);
  const before = fs.existsSync(target) ? fs.statSync(target).mtimeMs : 0;
  chrome(['--no-pdf-header-footer', '--virtual-time-budget=25000', '--run-all-compositor-stages-before-draw',
    '--allow-file-access-from-files', `--print-to-pdf=${target}`, fileUrl(html)]);
  fs.unlinkSync(html);
  // Chrome은 저장에 실패해도 오류를 내지 않음 → 파일 시각으로 확인 (PDF 뷰어에 열려 있으면 잠겨서 실패)
  if (!fs.existsSync(target) || fs.statSync(target).mtimeMs === before) {
    throw new Error(`${out} 저장 실패 — PDF 뷰어 등에서 파일이 열려 있으면 닫고 다시 실행하세요`);
  }
  console.log(out);
}

const PDFS = [
  { out: 'StudioNx_PRD_DB_통합본.pdf', title: 'Studio Nx', subtitle: 'PRD (Phase 0~6) &amp; DB 설계 · ERD 통합본',
    files: [...fs.readdirSync(path.join(DOCS, 'PRD')).filter(f => f.endsWith('.md')).sort().map(f => 'PRD/' + f), 'DB.md', 'ERD.md'] },
  { out: 'Implementation_Plan.pdf', title: 'Studio Nx', subtitle: '구현 계획 — 3단계 목록 &amp; 간트차트', files: ['Implementation_Plan.md'] },
  { out: '../studionx/db/docs/StudioNx_DB_Guide.pdf', title: 'Studio Nx', subtitle: 'DB 스크립트 가이드', files: ['../studionx/db/docs/StudioNx_DB_Guide.md'], base: '../studionx/db/docs' },
  { out: 'Sequencer_Feature_Gaps.pdf', title: 'Studio Nx', subtitle: '시퀀서 기능 보강 후보 — Ableton · FL Studio 매뉴얼 대조', files: ['Sequencer_Feature_Gaps.md'] },
  { out: 'Sequencer_Layout_Mockup.pdf', title: 'Studio Nx', subtitle: '시퀀서 기본 배치 목업', files: ['Sequencer_Layout_Mockup.md'] },
  { out: 'Sequencer_UI_Reference_Analysis.pdf', title: 'Studio Nx', subtitle: '시퀀서 UI 레퍼런스 분석 — Ableton · FL Studio', files: ['Sequencer_UI_Reference_Analysis.md'] },
  { out: 'Privacy_Policy_Draft.pdf', title: 'Studio Nx', subtitle: '개인정보 처리방침 수정안 (초안)', files: ['Privacy_Policy_Draft.md'] },
  { out: 'Ai_feedback.pdf', title: 'Studio Nx', subtitle: 'AI 제안 — 추가하면 좋을 기능', files: ['Ai_feedback.md'] },
  { out: 'Ai_feedback_moreExplain.pdf', title: 'Studio Nx', subtitle: 'AI 제안 추가 설명 — 상황 인지 팁 · 스냅샷 · 이름 추천', files: ['Ai_feedback_moreExplain.md'] },
  { out: 'Git_Manual.pdf', title: 'Studio Nx', subtitle: 'Git · GitHub 관리 매뉴얼', files: ['Git_Manual.md'] },
  { out: 'ai-notes/01_dev_environment.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 01 — 개발 환경 구축', files: ['ai-notes/01_dev_environment.md'], base: 'ai-notes' },
  { out: 'ai-notes/02_home_first_page.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 02 — 메인 페이지 구조 · 첫 화면', files: ['ai-notes/02_home_first_page.md'], base: 'ai-notes' },
  { out: 'ai-notes/03_home_revision_service.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 03 — 메인 페이지 수정 · Service 섹션', files: ['ai-notes/03_home_revision_service.md'], base: 'ai-notes' },
  { out: 'ai-notes/04_home_sections.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 04 — 메인 페이지 나머지 섹션 프로토타입', files: ['ai-notes/04_home_sections.md'], base: 'ai-notes' },
  { out: 'ai-notes/05_home_feature.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 05 — 모바일 띠 재조정 · Feature 섹션', files: ['ai-notes/05_home_feature.md'], base: 'ai-notes' },
  { out: 'ai-notes/06_common_forms.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 06 — 공통 폼 스타일 (B-2 밑줄형)', files: ['ai-notes/06_common_forms.md'], base: 'ai-notes' },
  { out: 'ai-notes/07_auth_pages.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 07 — 회원가입 페이지 · 로그인 모달', files: ['ai-notes/07_auth_pages.md'], base: 'ai-notes' },
  { out: 'ai-notes/08_backend_core.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 08 — 백엔드 공통 뼈대', files: ['ai-notes/08_backend_core.md'], base: 'ai-notes' },
  { out: 'ai-notes/09_frontend_api_core.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 09 — 프론트 공통 JS 뼈대', files: ['ai-notes/09_frontend_api_core.md'], base: 'ai-notes' },
  { out: 'ai-notes/10_common_partials.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 10 — 공통 헤더·푸터·로그인 모달 통합', files: ['ai-notes/10_common_partials.md'], base: 'ai-notes' },
  { out: 'ai-notes/11_error_pages.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 11 — 오류 페이지', files: ['ai-notes/11_error_pages.md'], base: 'ai-notes' },
  { out: 'ai-notes/13_mypage.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 13 — 마이페이지 대시보드', files: ['ai-notes/13_mypage.md'], base: 'ai-notes' },
  { out: 'ai-notes/14_myproject.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 14 — 나의 프로젝트', files: ['ai-notes/14_myproject.md'], base: 'ai-notes' },
  { out: 'ai-notes/15_userinfo.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 15 — 회원 정보', files: ['ai-notes/15_userinfo.md'], base: 'ai-notes' },
  { out: 'ai-notes/16_signup_api_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 16 — 회원가입 API 템플릿', files: ['ai-notes/16_signup_api_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/17_login_jwt_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 17 — 로그인 · 토큰 재발급 · 로그아웃 템플릿', files: ['ai-notes/17_login_jwt_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/18_user_profile_api_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 18 — 회원 정보 · 프로필 사진 API 템플릿', files: ['ai-notes/18_user_profile_api_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/19_password_withdraw_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 19 — 비밀번호 변경 · 회원 탈퇴 API 템플릿', files: ['ai-notes/19_password_withdraw_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/20_inquiry_api_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 20 — 문의 API 템플릿', files: ['ai-notes/20_inquiry_api_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/21_project_api_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 21 — 프로젝트 CRUD API 템플릿', files: ['ai-notes/21_project_api_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/22_dashboard_api_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 22 — 마이페이지 대시보드 API 템플릿', files: ['ai-notes/22_dashboard_api_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/23_dev_notes_admin_template.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 23 — Development 공지 API · 관리자 화면 템플릿', files: ['ai-notes/23_dev_notes_admin_template.md'], base: 'ai-notes' },
  { out: 'ai-notes/24_ui_review.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 24 — Phase 1 화면 점검과 수정', files: ['ai-notes/24_ui_review.md'], base: 'ai-notes' },
  { out: 'ai-notes/25_intro_logo.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 25 — 로고(S2) 확정과 첫 접속 로딩', files: ['ai-notes/25_intro_logo.md'], base: 'ai-notes' },
  { out: 'ai-notes/26_star_cursor.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 26 — 별 커서', files: ['ai-notes/26_star_cursor.md'], base: 'ai-notes' },
  { out: 'ai-notes/27_privacy_policy.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 27 — 개인정보 처리방침 페이지와 가입 동의', files: ['ai-notes/27_privacy_policy.md'], base: 'ai-notes' },
  { out: 'ai-notes/28_home_mobile_hero.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 28 — 홈 첫 화면 모바일 겹침 수정', files: ['ai-notes/28_home_mobile_hero.md'], base: 'ai-notes' },
  { out: 'ai-notes/29_sequencer_screen.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 29 — 시퀀서 화면 (studioNx.html)', files: ['ai-notes/29_sequencer_screen.md'], base: 'ai-notes' },
  { out: 'ai-notes/30_sequencer_arrange_drag.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 30 — 시퀀서 편곡 · 피아노롤 · 오토메이션', files: ['ai-notes/30_sequencer_arrange_drag.md'], base: 'ai-notes' },
  { out: 'ai-notes/31_sequencer_buttons.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 31 — 시퀀서 화면 버튼 전체', files: ['ai-notes/31_sequencer_buttons.md'], base: 'ai-notes' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/01_api_refreshAccessToken.pdf', title: 'Studio Nx', subtitle: 'JS 01 — refreshAccessToken()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/01_api_refreshAccessToken.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/02_api_apiFetch.pdf', title: 'Studio Nx', subtitle: 'JS 02 — apiFetch()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/02_api_apiFetch.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/03_auth_safeNextPath.pdf', title: 'Studio Nx', subtitle: 'JS 03 — safeNextPath()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/03_auth_safeNextPath.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/04_auth_loginUrl.pdf', title: 'Studio Nx', subtitle: 'JS 04 — loginUrl()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/04_auth_loginUrl.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/05_auth_parseLoginHash.pdf', title: 'Studio Nx', subtitle: 'JS 05 — parseLoginHash()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/05_auth_parseLoginHash.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/06_auth_isLoggedIn.pdf', title: 'Studio Nx', subtitle: 'JS 06 — isLoggedIn()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/06_auth_isLoggedIn.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/07_auth_requireLogin.pdf', title: 'Studio Nx', subtitle: 'JS 07 — requireLogin()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/07_auth_requireLogin.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/08_auth_logout.pdf', title: 'Studio Nx', subtitle: 'JS 08 — logout()', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/08_auth_logout.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-02 - 프론트 공통 JS/P1-02_frontend_api_core.pdf', title: 'Studio Nx', subtitle: 'P1-02 프론트 공통 JS — 함수 설명 합본 (01~08)', files: ['ai-notes/javascript/P1-02 - 프론트 공통 JS/01_api_refreshAccessToken.md', 'ai-notes/javascript/P1-02 - 프론트 공통 JS/02_api_apiFetch.md', 'ai-notes/javascript/P1-02 - 프론트 공통 JS/03_auth_safeNextPath.md', 'ai-notes/javascript/P1-02 - 프론트 공통 JS/04_auth_loginUrl.md', 'ai-notes/javascript/P1-02 - 프론트 공통 JS/05_auth_parseLoginHash.md', 'ai-notes/javascript/P1-02 - 프론트 공통 JS/06_auth_isLoggedIn.md', 'ai-notes/javascript/P1-02 - 프론트 공통 JS/07_auth_requireLogin.md', 'ai-notes/javascript/P1-02 - 프론트 공통 JS/08_auth_logout.md'], base: 'ai-notes/javascript/P1-02 - 프론트 공통 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/09_auth-ui_setFieldState.pdf', title: 'Studio Nx', subtitle: 'JS 09 — setFieldState()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/09_auth-ui_setFieldState.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/10_auth-ui_initPasswordToggles.pdf', title: 'Studio Nx', subtitle: 'JS 10 — initPasswordToggles()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/10_auth-ui_initPasswordToggles.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/11_auth-ui_initOAuthPlaceholders.pdf', title: 'Studio Nx', subtitle: 'JS 11 — initOAuthPlaceholders()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/11_auth-ui_initOAuthPlaceholders.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/12_auth-ui_initAuthState.pdf', title: 'Studio Nx', subtitle: 'JS 12 — initAuthState()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/12_auth-ui_initAuthState.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/13_auth-ui_initLoginForm.pdf', title: 'Studio Nx', subtitle: 'JS 13 — initLoginForm()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/13_auth-ui_initLoginForm.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/14_home_initLoginModalFromHash.pdf', title: 'Studio Nx', subtitle: 'JS 14 — initLoginModalFromHash()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/14_home_initLoginModalFromHash.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/15_join_initDuplicateChecks.pdf', title: 'Studio Nx', subtitle: 'JS 15 — initDuplicateChecks()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/15_join_initDuplicateChecks.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/16_join_initPasswordRules.pdf', title: 'Studio Nx', subtitle: 'JS 16 — initPasswordRules()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/16_join_initPasswordRules.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/17_join_initJoinForm.pdf', title: 'Studio Nx', subtitle: 'JS 17 — initJoinForm()', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/17_join_initJoinForm.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/P1-07 - 가입·로그인 JS/P1-07_auth_js.pdf', title: 'Studio Nx', subtitle: 'P1-07 가입 · 로그인 JS — 함수 설명 합본 (09~17)', files: ['ai-notes/javascript/P1-07 - 가입·로그인 JS/09_auth-ui_setFieldState.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/10_auth-ui_initPasswordToggles.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/11_auth-ui_initOAuthPlaceholders.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/12_auth-ui_initAuthState.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/13_auth-ui_initLoginForm.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/14_home_initLoginModalFromHash.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/15_join_initDuplicateChecks.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/16_join_initPasswordRules.md', 'ai-notes/javascript/P1-07 - 가입·로그인 JS/17_join_initJoinForm.md'], base: 'ai-notes/javascript/P1-07 - 가입·로그인 JS' },
  { out: 'ai-notes/javascript/fix - SweetAlert 알림창/18_dialog_showAlert.pdf', title: 'Studio Nx', subtitle: 'JS 18 — showAlert()', files: ['ai-notes/javascript/fix - SweetAlert 알림창/18_dialog_showAlert.md'], base: 'ai-notes/javascript/fix - SweetAlert 알림창' },
  { out: 'ai-notes/javascript/fix - SweetAlert 알림창/19_dialog_initFormAlerts.pdf', title: 'Studio Nx', subtitle: 'JS 19 — initFormAlerts()', files: ['ai-notes/javascript/fix - SweetAlert 알림창/19_dialog_initFormAlerts.md'], base: 'ai-notes/javascript/fix - SweetAlert 알림창' },
  { out: 'ai-notes/javascript/fix - SweetAlert 알림창/20_dialog_confirmDialog.pdf', title: 'Studio Nx', subtitle: 'JS 20 — confirmDialog()', files: ['ai-notes/javascript/fix - SweetAlert 알림창/20_dialog_confirmDialog.md'], base: 'ai-notes/javascript/fix - SweetAlert 알림창' },
  { out: 'ai-notes/javascript/fix - SweetAlert 알림창/21_dialog_promptDialog.pdf', title: 'Studio Nx', subtitle: 'JS 21 — promptDialog()', files: ['ai-notes/javascript/fix - SweetAlert 알림창/21_dialog_promptDialog.md'], base: 'ai-notes/javascript/fix - SweetAlert 알림창' },
  { out: 'ai-notes/javascript/fix - SweetAlert 알림창/FIX-01_sweetalert_dialogs.pdf', title: 'Studio Nx', subtitle: 'FIX-01 SweetAlert 알림 · 확인 · 입력창 — 함수 설명 합본 (18~21)', files: ['ai-notes/javascript/fix - SweetAlert 알림창/18_dialog_showAlert.md', 'ai-notes/javascript/fix - SweetAlert 알림창/19_dialog_initFormAlerts.md', 'ai-notes/javascript/fix - SweetAlert 알림창/20_dialog_confirmDialog.md', 'ai-notes/javascript/fix - SweetAlert 알림창/21_dialog_promptDialog.md'], base: 'ai-notes/javascript/fix - SweetAlert 알림창' },
  { out: 'ai-notes/32_p1-02_frontend_api_core.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 32 — P1-02 프론트 공통 JS', files: ['ai-notes/32_p1-02_frontend_api_core.md'], base: 'ai-notes' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/01_errors_app_error_handler.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 01 — error_json() · app_error_handler()', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/01_errors_app_error_handler.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/02_errors_validation_error_handler.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 02 — validation_error_handler()', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/02_errors_validation_error_handler.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/03_errors_http_error_handler.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 03 — http_error_handler()', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/03_errors_http_error_handler.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/04_errors_unexpected_error_handler.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 04 — unexpected_error_handler()', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/04_errors_unexpected_error_handler.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/05_security_decode_access_token.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 05 — decode_access_token() · _decode_token()', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/05_security_decode_access_token.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/06_deps_get_current_user.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 06 — get_current_user()', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/06_deps_get_current_user.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/07_deps_get_current_user_optional.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 07 — get_current_user_optional()', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/07_deps_get_current_user_optional.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/08_models_user.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 08 — User 모델 컬럼', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/08_models_user.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/09_models_inquiry.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 09 — Inquiry 모델 컬럼', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/09_models_inquiry.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/10_models_project.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 10 — Project 모델 컬럼', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/10_models_project.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/11_models_project_member.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 11 — ProjectMember 모델 컬럼', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/11_models_project_member.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/12_models_track.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 12 — Track 모델 컬럼 (Phase 1 칸)', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/12_models_track.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/13_models_relationships.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 13 — 모델 관계 (project.members · project.tracks)', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/13_models_relationships.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/14_security_check_password_rules.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 14 — check_password_rules()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/14_security_check_password_rules.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/15_security_hash_password.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 15 — hash_password()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/15_security_hash_password.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/16_security_verify_password.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 16 — verify_password()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/16_security_verify_password.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/17_auth_service_normalize_email.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 17 — normalize_email()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/17_auth_service_normalize_email.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/18_auth_service_release_withdrawn.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 18 — release_withdrawn()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/18_auth_service_release_withdrawn.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/19_auth_service_check_email.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 19 — check_email() · availability_of()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/19_auth_service_check_email.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/20_auth_service_check_nickname.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 20 — check_nickname()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/20_auth_service_check_nickname.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/21_auth_service_signup.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 21 — signup() · unavailable_error()', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/21_auth_service_signup.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/22_auth_route_signup.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 22 — POST /api/v1/auth/signup', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/22_auth_route_signup.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/23_auth_route_check_email.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 23 — GET /api/v1/auth/check-email', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/23_auth_route_check_email.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/24_auth_route_check_nickname.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 24 — GET /api/v1/auth/check-nickname', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/24_auth_route_check_nickname.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/25_auth_schema_signup_request.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 25 — SignupRequest · Nickname', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/25_auth_schema_signup_request.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/P1-04_signup_api.pdf', title: 'Studio Nx', subtitle: 'P1-04 회원가입 API — 함수 설명 합본 (14~25)', files: ['ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/14_security_check_password_rules.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/15_security_hash_password.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/16_security_verify_password.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/17_auth_service_normalize_email.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/18_auth_service_release_withdrawn.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/19_auth_service_check_email.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/20_auth_service_check_nickname.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/21_auth_service_signup.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/22_auth_route_signup.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/23_auth_route_check_email.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/24_auth_route_check_nickname.md', 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API/25_auth_schema_signup_request.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-04 - 회원가입 API' },
  { out: 'ai-notes/35_p1-04_signup_api.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 35 — P1-04 회원가입 API', files: ['ai-notes/35_p1-04_signup_api.md'], base: 'ai-notes' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/26_security_create_access_token.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 26 — create_access_token() · _create_token()', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/26_security_create_access_token.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/27_security_create_refresh_token.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 27 — create_refresh_token()', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/27_security_create_refresh_token.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/28_security_decode_refresh_token.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 28 — decode_refresh_token()', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/28_security_decode_refresh_token.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/29_auth_service_authenticate.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 29 — authenticate() · invalid_credentials()', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/29_auth_service_authenticate.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/30_auth_service_get_active_user.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 30 — get_active_user()', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/30_auth_service_get_active_user.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/31_auth_route_refresh_cookie.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 31 — set_refresh_cookie() · clear_refresh_cookie()', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/31_auth_route_refresh_cookie.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/32_auth_route_login.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 32 — POST /api/v1/auth/login', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/32_auth_route_login.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/33_auth_route_refresh.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 33 — POST /api/v1/auth/refresh', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/33_auth_route_refresh.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/34_auth_route_logout.pdf', title: 'Studio Nx', subtitle: 'Backend(FastAPI/Python) 34 — POST /api/v1/auth/logout', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/34_auth_route_logout.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/P1-05_login_api.pdf', title: 'Studio Nx', subtitle: 'P1-05 로그인 API — 함수 설명 합본 (26~34)', files: ['ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/26_security_create_access_token.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/27_security_create_refresh_token.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/28_security_decode_refresh_token.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/29_auth_service_authenticate.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/30_auth_service_get_active_user.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/31_auth_route_refresh_cookie.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/32_auth_route_login.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/33_auth_route_refresh.md', 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API/34_auth_route_logout.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-05 - 로그인 API' },
  { out: 'ai-notes/36_p1-05_login_api.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 36 — P1-05 로그인 API', files: ['ai-notes/36_p1-05_login_api.md'], base: 'ai-notes' },
  { out: 'ai-notes/37_p1-04_05_site_test.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 37 — P1-04 · P1-05 실제 사이트 시험', files: ['ai-notes/37_p1-04_05_site_test.md'], base: 'ai-notes' },
  { out: 'ai-notes/38_p1-07_auth_js.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 38 — P1-07 가입 · 로그인 JS', files: ['ai-notes/38_p1-07_auth_js.md'], base: 'ai-notes' },
  { out: 'ai-notes/39_p1-07_site_test.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 39 — P1-07 실제 사이트 시험', files: ['ai-notes/39_p1-07_site_test.md'], base: 'ai-notes' },
  { out: 'ai-notes/40_fix_sweetalert_dialogs.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 40 — FIX-01 SweetAlert 알림 · 확인 · 입력창', files: ['ai-notes/40_fix_sweetalert_dialogs.md'], base: 'ai-notes' },
  { out: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/P1-03_backend_core.pdf', title: 'Studio Nx', subtitle: 'P1-03 백엔드 공통 — 함수 설명 합본 (01~13)', files: ['ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/01_errors_app_error_handler.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/02_errors_validation_error_handler.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/03_errors_http_error_handler.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/04_errors_unexpected_error_handler.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/05_security_decode_access_token.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/06_deps_get_current_user.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/07_deps_get_current_user_optional.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/08_models_user.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/09_models_inquiry.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/10_models_project.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/11_models_project_member.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/12_models_track.md', 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통/13_models_relationships.md'], base: 'ai-notes/backend(fastAPI_Python)/P1-03 - 백엔드 공통' },
  { out: 'ai-notes/33_p1-03_backend_core.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 33 — P1-03 백엔드 공통', files: ['ai-notes/33_p1-03_backend_core.md'], base: 'ai-notes' },
  { out: 'ai-notes/34_p1-02_03_site_test.pdf', title: 'Studio Nx', subtitle: 'AI 구현 설명 34 — P1-02 · P1-03 실제 사이트 시험', files: ['ai-notes/34_p1-02_03_site_test.md'], base: 'ai-notes' },
];

const mode = process.argv[2];
if (mode !== 'pdf') buildErd();
const only = process.argv[3];
if (mode !== 'erd') PDFS.filter(p => !only || p.out.includes(only)).forEach(buildPdf);
fs.rmSync(TMP, { recursive: true, force: true });
