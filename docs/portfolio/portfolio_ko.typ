// Studio Nx 포트폴리오 (Typst, 한국어)
// ビルド: typst compile docs/portfolio/portfolio_ko.typ docs/portfolio/StudioNx_Portfolio_ko.pdf

#let accent = rgb("#6d4aff")
#let accent2 = rgb("#0891b2")
#let ink = rgb("#1f2430")
#let muted = rgb("#5b6475")
#let line-c = rgb("#d9dcec")
#let soft = rgb("#f4f2ff")

#set document(title: "Studio Nx 포트폴리오", author: "Studio Nx")
#set page(
  paper: "a4",
  margin: (x: 18mm, top: 20mm, bottom: 18mm),
  footer: context [
    #set text(size: 8pt, fill: muted)
    Studio Nx 포트폴리오 #h(1fr) #counter(page).display() / #counter(page).final().first()
  ],
)
#set text(font: ("Malgun Gothic", "Noto Sans JP"), lang: "ko", size: 9.5pt, fill: ink)
#set par(leading: 0.85em, justify: false)
#set list(indent: 1mm, body-indent: 2mm, marker: text(fill: accent)[•])
#set enum(indent: 1mm, body-indent: 2mm)

// 見出し
#show heading.where(level: 1): it => {
  v(5mm, weak: true)
  block(width: 100%, below: 3.5mm)[
    #grid(
      columns: (3pt, 1fr),
      column-gutter: 2.5mm,
      rect(width: 3pt, height: 1.15em, fill: accent, radius: 1pt),
      text(size: 13pt, weight: "bold")[#it.body],
    )
  ]
}
#show heading.where(level: 2): it => {
  v(2mm, weak: true)
  block(below: 2mm, text(size: 10.5pt, weight: "bold", fill: accent)[#it.body])
}
#show link: set text(fill: accent2)

// 表(ヘッダ行つき)
#let table-style(columns, ..cells) = table(
  columns: columns,
  stroke: (x, y) => (bottom: 0.5pt + line-c),
  fill: (x, y) => if y == 0 { soft } else { none },
  inset: (x: 3mm, y: 2.2mm),
  align: left + horizon,
  ..cells,
)

#let tag(body, color: accent) = box(
  fill: color.lighten(88%), inset: (x: 2mm, y: 0.8mm), radius: 2pt,
  text(size: 8.5pt, fill: color.darken(15%), weight: "bold")[#body],
)

// 画像(Archify の出力は下端にカードが少し写るため、下を切り取る)
#let figure-img(path, caption, w: 135mm, crop: 0.95) = {
  let full = w * 1320 / 2048
  align(center, figure(
    block(
      stroke: 0.5pt + line-c, radius: 3pt, clip: true, width: w, height: full * crop,
      align(top, image(path, width: w)),
    ),
    caption: caption,
    supplement: none,
    numbering: none,
  ))
}
#show figure.caption: set text(size: 8.5pt, fill: muted)

// ───────── 표지 블록 ─────────
#block(
  width: 100%, fill: accent, radius: 5pt, inset: (x: 9mm, y: 8mm),
)[
  #set text(fill: white)
  #text(size: 9pt, tracking: 0.12em)[PORTFOLIO]
  #v(1mm)
  #text(size: 26pt, weight: "bold")[Studio Nx]
  #v(0.5mm)
  #text(size: 12pt)[웹 기반 DAW 시퀀서]
  #v(3mm)
  #line(length: 100%, stroke: 0.5pt + white.transparentize(60%))
  #v(2.5mm)
  브라우저에서 작곡할 수 있는 음악 제작 도구(DAW)를 개인 프로젝트로 개발하고 있습니다.
  기획부터 화면, 서버, 데이터베이스, 테스트, 문서화까지 전 과정을 경험하면서 AI(Claude Code)와 협업해 진행하고 있습니다.
]

#v(4mm)

#grid(
  columns: (1fr, 1fr, 1fr),
  column-gutter: 3mm,
  ..(
    ("형태", "개인 개발", "AI의 도움을 받아 진행합니다"),
    ("개발 기간", "2026년 10월~", "첫 공개 버전은 2027년 2월이 목표입니다"),
    ("현재 단계", "1단계 막바지", "전체 확인과 안정화를 진행하고 있습니다"),
  ).map(((k, v, s)) => block(
    stroke: 0.5pt + line-c, radius: 3pt, inset: 3.5mm, width: 100%,
  )[
    #text(size: 8pt, fill: muted)[#k]\
    #text(size: 11pt, weight: "bold")[#v]\
    #text(size: 8.5pt, fill: muted)[#s]
  ]),
)

= 개발 진행 상황(2026년 10월 26일 기준)

#block(fill: soft, radius: 3pt, inset: 4mm, width: 100%)[
  #grid(
    columns: (auto, 1fr),
    column-gutter: 5mm,
    align: horizon,
    text(size: 11pt, weight: "bold")[1단계: 13개 항목 중 12개 완료(약 92%)],
    box(width: 100%, height: 6pt, radius: 3pt, fill: white, stroke: 0.5pt + line-c)[
      #box(width: 92%, height: 100%, radius: 3pt, fill: accent)
    ],
  )
]

#v(2mm)
#table-style(
  (1fr, 24mm),
  [*항목*], [*상태*],
  [환경 구축, 회원가입과 로그인, 프로젝트 관리], tag(color: rgb("#16a34a"))[완료],
  [소리를 내는 기본 기능, 타임라인, 샘플 가져오기], tag(color: rgb("#16a34a"))[완료],
  [피아노롤(음표 입력), 음원과 이펙트], tag(color: rgb("#16a34a"))[완료],
  [프로젝트 저장과 불러오기, 실행 취소와 다시 실행], tag(color: rgb("#16a34a"))[완료],
  [WAV 파일 내보내기], tag(color: rgb("#16a34a"))[완료],
  [소리 확인 테스트, 전체 안정화], tag(color: rgb("#d97706"))[진행 중],
)

= 프로젝트 개요

== 만든 이유
설치 없이 브라우저만으로 작곡할 수 있고, 앞으로 다른 사람과의 공동 작업이나 AI의 제안까지 활용할 수 있는 음악 제작 도구를 만들어 보고 싶었습니다.

== 목표 기능
+ 회원가입, 로그인, 프로젝트 관리
+ 음악 제작: 샘플 가져오기, 피아노롤 입력, 음원과 이펙트
+ WAV 등 오디오 파일 내보내기
+ AI의 설정 제안(향후 계획)
+ 여러 사람의 공동 편집(향후 계획)

= 사용하는 기술

#table-style(
  (34mm, 1fr),
  [*영역*], [*기술*],
  [화면], [HTML, CSS, JavaScript],
  [오디오], [브라우저의 Web Audio API],
  [서버], [Python, FastAPI],
  [데이터베이스], [MySQL],
  [개발 관리], [Git, GitHub, YouTrack],
  [향후 계획], [C++을 학습하고 있습니다(추상 메서드 범위까지 배웠습니다). JUCE 프레임워크는 학습 계획 단계이며, 앞으로 오디오 처리에 활용하는 방안을 검토하고 있습니다.],
)

= 만든 기능

#table-style(
  (34mm, 1fr),
  [*분류*], [*내용*],
  [계정], [회원가입, 로그인, 회원 정보 수정, 비밀번호 재설정, 탈퇴],
  [페이지], [홈, 마이페이지, 내 프로젝트, 오류 페이지],
  [음악 제작 화면], [타임라인, 샘플 가져오기, 피아노롤, 음원과 이펙트 추가, 프로젝트 저장과 불러오기],
)

= 전체 구성

== 시스템 구성
#figure-img("studionx-architecture-v2.png", [Studio Nx 전체 구성(도식 안의 라벨은 일본어입니다)], crop: 0.94)
클릭해서 확인할 수 있는 인터랙티브 버전: #link("https://good200005.github.io/StudioNx/")

== 데이터 구조(ER 다이어그램)
#figure-img("studionx-erd.png", [Studio Nx 데이터 구조(실제 테이블 중 주요 항목만 수록, 도식 안의 라벨은 일본어입니다)], crop: 0.965)
인터랙티브 버전: #link("https://good200005.github.io/StudioNx/erd.html")

= 화면 캡처
실제로 동작하는 화면입니다.

#let shot(path, title, desc) = block(width: 100%, breakable: false)[
  #block(stroke: 0.5pt + line-c, radius: 3pt, clip: true, image(path, width: 100%))
  #v(1mm)
  #text(weight: "bold", size: 9pt)[#title]\
  #text(size: 8.5pt, fill: muted)[#desc]
]

#grid(
  columns: (1fr, 1fr),
  column-gutter: 5mm,
  row-gutter: 5mm,
  shot("../screenshots/2026-10-17_s1-08_track_roll/03_piano_roll.png", "피아노롤", "음표를 입력합니다."),
  shot("../screenshots/2026-10-18_s1-09_devices/03_picker.png", "음원·이펙트 선택", "트랙에 추가합니다."),
  shot("../screenshots/2026-10-18_s1-09_devices/05_modal.png", "상세 설정", "음원의 세부 설정을 합니다."),
  shot("../screenshots/2026-10-19_s1-10_full_save/04_command_palette.png", "커맨드 팔레트", "동작을 검색해서 실행합니다."),
)

= 향후 계획

#table-style(
  (24mm, 1fr, 34mm),
  [*단계*], [*내용*], [*시기(목표)*],
  [1단계], [작곡, 저장, WAV 내보내기], [2027년 2월까지],
  [2단계], [녹음, MP3 내보내기, AI의 설정 제안 등], [2027년 7월까지],
  [3단계], [여러 사람의 공동 편집, 채팅 등], [2027년 11월까지],
)

= 진행 방식과 배운 점

- 기능별로 작게 나누고, 완성하면 동작 확인과 테스트를 거쳐 다음으로 넘어갑니다. 자동 테스트는 1000개 이상입니다.
- AI의 도움을 받아 개발하며, 작성한 코드는 설명 문서로 남겨서 나중에 내용을 다시 검토할 수 있게 했습니다.
- 시간대 어긋남이나 컴퓨터 간 환경 차이처럼 실제로 부딪힌 문제를 하나씩 해결한 경험을 쌓았습니다.
- 계획, 구현, 확인, 기록의 흐름을 혼자서도 돌릴 수 있게 되었습니다.

= 링크

#block(breakable: false, table-style(
  (46mm, 1fr),
  [*종류*], [*링크*],
  [GitHub], link("https://github.com/good200005/StudioNx"),
  [구성도(인터랙티브)], link("https://good200005.github.io/StudioNx/"),
  [ER 다이어그램(인터랙티브)], link("https://good200005.github.io/StudioNx/erd.html"),
  [시연 영상], [추가 예정],
  [연락처], [(이메일 등을 입력해 주세요)],
))
