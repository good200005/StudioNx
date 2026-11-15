// Studio Nx ポートフォリオ (Typst)
// ビルド: typst compile docs/portfolio/portfolio.typ docs/portfolio/StudioNx_Portfolio_ja.pdf

#let accent = rgb("#6d4aff")
#let accent2 = rgb("#0891b2")
#let ink = rgb("#1f2430")
#let muted = rgb("#5b6475")
#let line-c = rgb("#d9dcec")
#let soft = rgb("#f4f2ff")

#set document(title: "Studio Nx ポートフォリオ", author: "Studio Nx")
#set page(
  paper: "a4",
  margin: (x: 18mm, top: 20mm, bottom: 18mm),
  footer: context [
    #set text(size: 8pt, fill: muted)
    Studio Nx ポートフォリオ #h(1fr) #counter(page).display() / #counter(page).final().first()
  ],
)
#set text(font: ("Noto Sans JP", "Yu Gothic", "Meiryo"), lang: "ja", size: 9.5pt, fill: ink)
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

// ───────── 表紙ブロック ─────────
#block(
  width: 100%, fill: accent, radius: 5pt, inset: (x: 9mm, y: 8mm),
)[
  #set text(fill: white)
  #text(size: 9pt, tracking: 0.12em)[PORTFOLIO]
  #v(1mm)
  #text(size: 26pt, weight: "bold")[Studio Nx]
  #v(0.5mm)
  #text(size: 12pt)[Web ベース DAW シーケンサー]
  #v(3mm)
  #line(length: 100%, stroke: 0.5pt + white.transparentize(60%))
  #v(2.5mm)
  ブラウザで作曲できる音楽制作ツール(DAW)を、個人プロジェクトとして開発しています。
  企画から画面、サーバー、データベース、テスト、ドキュメントまでを一通り経験しながら、AI(Claude Code)と協力して進めています。
]

#v(4mm)

#grid(
  columns: (1fr, 1fr, 1fr),
  column-gutter: 3mm,
  ..(
    ("形態", "個人開発", "AI の支援を受けながら進行"),
    ("開発期間", "2026年10月〜", "最初の公開版は 2027年2月が目標"),
    ("現在の段階", "第1段階の終盤", "全体の確認と安定化を進行中"),
  ).map(((k, v, s)) => block(
    stroke: 0.5pt + line-c, radius: 3pt, inset: 3.5mm, width: 100%,
  )[
    #text(size: 8pt, fill: muted)[#k]\
    #text(size: 11pt, weight: "bold")[#v]\
    #text(size: 8.5pt, fill: muted)[#s]
  ]),
)

// ───────── 1. 進捗 ─────────
= 開発の進捗(2026年10月26日時点)

#block(fill: soft, radius: 3pt, inset: 4mm, width: 100%)[
  #grid(
    columns: (auto, 1fr),
    column-gutter: 5mm,
    align: horizon,
    text(size: 11pt, weight: "bold")[第1段階: 13 項目中 12 項目が完了(約 92%)],
    box(width: 100%, height: 6pt, radius: 3pt, fill: white, stroke: 0.5pt + line-c)[
      #box(width: 92%, height: 100%, radius: 3pt, fill: accent)
    ],
  )
]

#v(2mm)
#table-style(
  (1fr, 24mm),
  [*項目*], [*状態*],
  [環境構築、会員登録・ログイン、プロジェクト管理], tag(color: rgb("#16a34a"))[完了],
  [音を鳴らす基本機能、タイムライン、サンプルの取り込み], tag(color: rgb("#16a34a"))[完了],
  [ピアノロール(音符の入力)、音源とエフェクト], tag(color: rgb("#16a34a"))[完了],
  [プロジェクトの保存と読み込み、元に戻す / やり直す], tag(color: rgb("#16a34a"))[完了],
  [WAV ファイルの書き出し], tag(color: rgb("#16a34a"))[完了],
  [音の確認テスト、全体の安定化], tag(color: rgb("#d97706"))[作成中],
)

// ───────── 2. 概要 ─────────
= プロジェクト概要

== 作った理由
インストール不要で、ブラウザだけで作曲でき、将来は他の人との共同作業や AI による提案も使える音楽制作ツールを作ってみたいと考えました。

== 目指す機能
+ 会員登録、ログイン、プロジェクト管理
+ 音楽制作: サンプルの取り込み、ピアノロールでの入力、音源とエフェクト
+ WAV などの音声ファイルの書き出し
+ AI による設定の提案(今後の予定)
+ 複数人での共同編集(今後の予定)

// ───────── 3. 技術 ─────────
= 使っている技術

#table-style(
  (28mm, 1fr),
  [*領域*], [*技術*],
  [画面], [HTML、CSS、JavaScript],
  [音声], [ブラウザの Web Audio API],
  [サーバー], [Python、FastAPI],
  [データベース], [MySQL],
  [開発の管理], [Git、GitHub、YouTrack],
  [今後の予定], [C++ を学習中(抽象メソッドの範囲まで学びました)。JUCE フレームワークは学習計画の段階で、将来の音声処理への活用を検討しています。],
)

// ───────── 5. 機能 ─────────
= 作った機能

#table-style(
  (28mm, 1fr),
  [*分類*], [*内容*],
  [アカウント], [会員登録、ログイン、会員情報の変更、パスワードの再設定、退会],
  [ページ], [ホーム、マイページ、マイプロジェクト、エラーページ],
  [音楽制作画面], [タイムライン、サンプルの取り込み、ピアノロール、音源とエフェクトの追加、プロジェクトの保存と読み込み],
)

// ───────── 4. 構成 ─────────
= 全体の構成

== システムの構成
#figure-img("studionx-architecture-v2.png", [Studio Nx の全体構成], crop: 0.94)
インタラクティブ版(クリックで各部分のつながりを確認できます): #link("https://good200005.github.io/StudioNx/")

== データの構造(ER 図)
#figure-img("studionx-erd.png", [Studio Nx のデータ構造(実際のテーブルから主な項目だけを掲載)], crop: 0.965)
インタラクティブ版: #link("https://good200005.github.io/StudioNx/erd.html")

// ───────── 6. 画面 ─────────
= 画面ショット
実際に動かしている画面です。

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
  shot("../screenshots/2026-10-17_s1-08_track_roll/03_piano_roll.png", "ピアノロール", "音符を入力します。"),
  shot("../screenshots/2026-10-18_s1-09_devices/03_picker.png", "音源・エフェクトの選択", "トラックに追加します。"),
  shot("../screenshots/2026-10-18_s1-09_devices/05_modal.png", "詳細設定", "音源の細かい設定を行います。"),
  shot("../screenshots/2026-10-19_s1-10_full_save/04_command_palette.png", "コマンドパレット", "操作を検索して実行します。"),
)

// ───────── 7. 予定 ─────────
= 今後の予定

#table-style(
  (24mm, 1fr, 34mm),
  [*段階*], [*内容*], [*時期の目安*],
  [第1段階], [作曲、保存、WAV 書き出し], [2027年2月まで],
  [第2段階], [録音、MP3 書き出し、AI による設定の提案など], [2027年7月まで],
  [第3段階], [複数人での共同編集、チャットなど], [2027年11月まで],
)

// ───────── 8. 進め方 ─────────
= 進め方と学んだこと

- 機能ごとに小さく区切り、完成したら動作確認とテストを行って次へ進めています。自動テストは 1000 件以上あります。
- AI の支援を受けながら開発し、書いたコードは解説ドキュメントとして残して、後から内容を見直せるようにしています。
- 時刻のずれやパソコン間の環境の違いなど、実際にぶつかった問題を一つずつ解決する経験を積みました。
- 計画、実装、確認、記録という流れを、一人でも回せるようになってきました。

// ───────── 9. リンク ─────────
= リンク

#block(breakable: false, table-style(
  (46mm, 1fr),
  [*種類*], [*リンク*],
  [GitHub], link("https://github.com/good200005/StudioNx"),
  [構成図(インタラクティブ)], link("https://good200005.github.io/StudioNx/"),
  [ER 図(インタラクティブ)], link("https://good200005.github.io/StudioNx/erd.html"),
  [デモ動画], [追加予定],
  [連絡先], [(メールアドレスなどを入力してください)],
))
