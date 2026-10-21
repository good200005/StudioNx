# Studio Nx

ブラウザだけで使えるWebベースの音楽制作ソフト（DAW）を、企画・設計から開発まで一人で進めている個人開発プロジェクトです。

- **開発状況**: 開発中（2026年10月2日に着手）
- **開発体制**: 個人開発（企画・設計・実装を担当）

## 目指す機能

- サンプルのドラッグ＆ドロップやMIDI入力による曲作り
- WAV / MP3 での書き出し
- ブラウザ上だけで完結する操作（インストール不要）

## 計画中の機能

- AIによる参考曲の分析
- 複数人での同時編集・チャット
- C++による音声処理モジュール（JUCE → WebAssembly）との連携

## 技術スタック

| 領域 | 技術 |
|---|---|
| フロントエンド | HTML5 / CSS / JavaScript（Vanilla、ビルドツールなし）、Web Audio API、Web MIDI API |
| バックエンド | Python 3.13 / FastAPI、SQLAlchemy 2、PyMySQL |
| データベース | MySQL 8.0 |
| エラー監視 | Sentry |
| ネイティブ（計画中） | C++（JUCE → WebAssembly） |

## リポジトリ構成

| パス | 内容 |
|---|---|
| [`studionx/`](./studionx) | アプリ本体（バックエンド、フロントエンド、DB、ネイティブ、テスト）。セットアップ方法は [`studionx/README.md`](./studionx/README.md)（韓国語）を参照 |
| [`docs/`](./docs) | 企画・設計ドキュメント（PRD、DB設計、ERD、実装計画 など） |

主なドキュメント:
[`docs/DB.md`](./docs/DB.md) / [`docs/ERD.md`](./docs/ERD.md) / [`docs/Implementation_Plan.md`](./docs/Implementation_Plan.md)

## 作者

Kim Taemin（キム・テミン）
