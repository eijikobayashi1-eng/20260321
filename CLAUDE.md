# プロジェクトメモ

## 漫画制作AIエージェント（manga-pipeline/）

- **設計図は `docs/blueprint/manga_agent_ecosystem_orgchart.html`（コルト AIエージェントエコシステム 体系図）。** 要約と進捗表は `docs/blueprint/README.md`。新しいエージェントを作るときは必ずこの設計図に合わせる。
- **体系図を更新したら、必ず Google ドライブにも保存する。** 保存先はユーザーのPCの
  `C:\Users\eijik\Google ドライブ\pc-NEC\D\EIJI\ＰＢ移動用\コルト\AIエージェント化開発会議`。
  Google Drive 上では「コルト ＞ AIエージェント化開発会議」フォルダ（folder ID: `1myrK3GID6Eb0CJZW4S7BzOjqr0zjiZTD`）。
  クラウドセッションからは Google Drive コネクタで、このフォルダに HTML のまま（Google形式に変換せず）アップロードする。
  更新時は同名ファイルを上書きできないため、ファイル名に日付を付けた新版を追加する（例: `manga_agent_ecosystem_orgchart_20261201.html`）。
  初版: `manga_agent_ecosystem_orgchart.html`（2026-11-15 保存、file ID: `1-Nx8w94H3WpzGm-sr1uyV1kMGzHEZB8c`）。
- **操作マニュアルは Word（.docx）で作り、同じ Google ドライブのフォルダ（AIエージェント化開発会議）に保存する。** 控えと作成用スクリプトは `docs/manual/`（`node docs/manual/build_manual.js 出力.docx`）。エージェントを追加したらマニュアルも更新する。
- ユーザーの方針: **エージェントは1つずつ作る。** 一度に複数のエージェントを実装しない。1つ作ったら確認をもらってから次へ進む。
- 実装済み: INPUT00, MANGA00。次は STORY01 → STORY02 → STORY03 → PROP01(WF1) → PROP02(WF2 GATE) → VISUAL → CSP。エージェントを追加したら `manga-pipeline/src/blueprint.ts` と MANGA00 の判断ルールも見直す。
- **ユーザーへの説明・コミットメッセージ・プルリクエストはすべて日本語で書く**（英語は読めないため）。
- 使用AIは体系図の指定（Claude は Sonnet。すべて仮設定）。
- エージェント追加手順は `manga-pipeline/README.md` を参照。

## ルート（src/）

- `src/` は別件の CLI（claude-link）。漫画パイプラインとは無関係。
