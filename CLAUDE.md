# プロジェクトメモ

## 漫画制作AIエージェント（manga-pipeline/）

- **設計図は `docs/blueprint/manga_agent_ecosystem_orgchart.html`（コルト AIエージェントエコシステム 体系図）。** 要約と進捗表は `docs/blueprint/README.md`。新しいエージェントを作るときは必ずこの設計図に合わせる。
- ユーザーの方針: **エージェントは1つずつ作る。** 一度に複数のエージェントを実装しない。1つ作ったら確認をもらってから次へ進む。
- 順番: INPUT00 → STORY01 → STORY02 → STORY03 → PROP01(WF1) → PROP02(WF2 GATE) → VISUAL → CSP。MANGA00 はエージェントが揃うにつれて育てる。
- 使用AIは体系図の指定（Claude は Sonnet。すべて仮設定）。
- エージェント追加手順は `manga-pipeline/README.md` を参照。

## ルート（src/）

- `src/` は別件の CLI（claude-link）。漫画パイプラインとは無関係。
