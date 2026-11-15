# コルト AIエージェント 漫画制作パイプライン

設計図: [`../docs/blueprint/manga_agent_ecosystem_orgchart.html`](../docs/blueprint/manga_agent_ecosystem_orgchart.html)（コルト AIエージェントエコシステム 体系図）
進捗: [`../docs/blueprint/README.md`](../docs/blueprint/README.md)

エージェントは体系図の順に **1つずつ** 作っていきます。現在動くのは **INPUT00（顧客情報収集）** だけです。

## セットアップ

```bash
cd manga-pipeline
npm install
```

Claude API のキーを設定します（`ANTHROPIC_API_KEY`、または `ant auth login`）。

## 使い方

### INPUT00 顧客情報収集（Step 0）

ヒアリングメモ・メール・議事録などをテキストファイルにまとめて渡します。

```bash
npm run manga -- run INPUT00 examples/hearing-memo.md
```

`runs/<日時>/` に次のファイルができます。

| ファイル | 内容 |
|---|---|
| `source.md` | 投入した資料のコピー |
| `INPUT00.json` | 顧客情報（次のエージェントに渡すデータ） |
| `INPUT00.md` | 顧客情報シート（スタッフ確認用・顧客への確認質問つき） |

顧客から回答が来たら、`runs/<日時>/source.md` に追記して再実行します。

```bash
npm run manga -- rerun INPUT00 <runId>
```

API キーなしで動作確認する場合は `--mock` を付けます。

## 設定

| 項目 | 場所 |
|---|---|
| コルトスタイルガイド（全エージェント共通） | `config/colt-style.md` |
| 使用モデル | 環境変数 `MANGA_MODEL`（既定: `claude-sonnet-5-5`。体系図の「Claude（Sonnet）」） |
| 各エージェントの役割プロンプト | `src/agents/*.ts` |

安全分類器による拒否が起きた場合は、サーバー側で別モデルに自動で切り替わります（`fallbacks: "default"`）。

## 構成

```
src/
  cli.ts          コマンド
  runner.ts       MANGA00 の土台（エージェント実行・成果物保存）
  llm.ts          Claude API 呼び出し（構造化出力・ストリーミング）
  schemas.ts      各エージェントの出力スキーマ
  report.ts       成果物 → スタッフ確認用 Markdown
  agents/
    index.ts      エージェント登録簿
    input.ts      INPUT00
```

## 新しいエージェントの追加手順

1. `src/schemas.ts` に出力スキーマを追加
2. `src/agents/<team>.ts` にエージェントを定義（役割プロンプト・入力の組み立て・モック）
3. `src/agents/types.ts` の `Outputs` と `src/agents/index.ts` に登録
4. 必要なら `src/report.ts` に確認用 Markdown を追加
5. `docs/blueprint/README.md` の進捗表を更新
