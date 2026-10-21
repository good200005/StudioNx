# Studio Nx

ブラウザだけで使えるWebベースの音楽制作ソフト（DAW）を、企画・設計から開発まで一人で進めている個人開発プロジェクトです。

- **開発状況**: 開発中（2026年10月2日に着手、2026年10月21日時点）。第1段階（MVP）の主要機能を実装済みで、現在は音声の回帰テスト基盤とMVPの安定化に進むところです。MVPの公開目標は2027年2月26日です。
- **開発体制**: 個人開発（企画・設計・実装を担当）

## 実装済みの機能

- 会員登録、ログイン、パスワード再設定、マイページ
- プロジェクトの作成・保存（自動保存、Undo / Redo 対応）
- サンプルライブラリ（ドラッグ＆ドロップでアップロード、タグ、波形表示）
- シーケンサー（トラック、オーディオ・MIDIクリップ、ピアノロール）
- 内蔵の楽器: Subtractive Synth、Sampler（Classic / One-Shot の2モード。MIDIノートでサンプルを演奏）
- 内蔵のエフェクト: EQ、Compressor、Reverb、Limiter、Gain、Delay、およびトラックミキサー（音量、パン、ミュート、ソロ、マスター）
- WAV書き出し（16 / 24 / 32bit、44.1 / 48kHz、書き出し範囲の指定、ノーマライズ、テール）。再生と同じ処理で音を作るため、聴こえる音とファイルの音が一致します

## 計画中の機能

- MP3 などWAV以外の書き出し、ステム書き出し
- 楽器の拡張（Drum Rack、FM シンセなど）とエフェクトの追加
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
