# コルト AIエージェント 漫画制作パイプライン

設計図: [`../docs/blueprint/manga_agent_ecosystem_orgchart.html`](../docs/blueprint/manga_agent_ecosystem_orgchart.html)（コルト AIエージェントエコシステム 体系図）
進捗: [`../docs/blueprint/README.md`](../docs/blueprint/README.md)

エージェントは体系図の順に **1つずつ** 作っていきます。現在動くのは **MANGA00（オーケストレーター）** と **INPUT00（顧客情報収集）** です。

## セットアップ

```bash
cd manga-pipeline
npm install
```

Claude API のキーを設定します（`ANTHROPIC_API_KEY`、または `ant auth login`）。

## 使い方

### 基本: MANGA00 に案件を任せる

ヒアリングメモ・メール・議事録などをテキストファイルにまとめて渡します。

```bash
npm run manga -- start examples/hearing-memo.md
```

MANGA00 が状況を判断しながら、動かせるエージェントを順に動かします。
人の対応が必要になると止まり、`runs/<日時>/NEXT_ACTION.md` に「誰に・何を」依頼するかを書き出します。

| 止まる場面 | 対応 |
|---|---|
| 顧客情報に必須項目の不足がある | NEXT_ACTION.md の質問を顧客に送り、回答を `source.md` の末尾に追記 |
| 次のエージェントがまだ未実装 | それまでの成果物をもとにスタッフが手作業で進める |
| WF2（稟議承認）の承認待ち | 承認が得られたら `npm run manga -- approve <runId> WF2 --by 承認者名` |
| MANGA00 の判断がルール違反（差し止め） | 内容を確認し、資料や成果物を直す |

対応が終わったら MANGA00 を再開します。

```bash
npm run manga -- continue <runId>
```

進み具合の確認:

```bash
npm run manga -- status <runId>
```

MANGA00 の判断の経緯は `runs/<日時>/MANGA00_log.md` に残ります。

#### MANGA00 のルール（コードで強制）

MANGA00（Claude）の判断は、実行前に次の点をコードで確認します。合わない判断は実行せず「差し止め」て止まります。

- 実装済みのエージェントか
- 前提となる成果物が揃っているか（設計図の順番）
- GATE を通過しているか（WF2 の承認前は VISUAL・CSP の本制作に着手しない）
- 資料も指示も変わらないまま、同じエージェントを続けて実行していないか

### INPUT00 だけを単体で動かす（Step 0）

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
  blueprint.ts    設計図（全エージェントの順番・前提・GATE）
  orchestrator.ts MANGA00 の実行ループ（判断 → チェック → 実行）
  state.ts        案件の状態（実行記録・承認・判断履歴）
  runner.ts       エージェント実行・成果物保存
  llm.ts          Claude API 呼び出し（構造化出力・ストリーミング）
  schemas.ts      各エージェントの出力スキーマ
  report.ts       成果物 → スタッフ確認用 Markdown
  agents/
    index.ts      エージェント登録簿
    manga00.ts    MANGA00（判断の役割プロンプト）
    input.ts      INPUT00
```

## 新しいエージェントの追加手順

1. `src/schemas.ts` に出力スキーマを追加
2. `src/agents/<team>.ts` にエージェントを定義（役割プロンプト・入力の組み立て・モック）
3. `src/agents/types.ts` の `Outputs` と `src/agents/index.ts` に登録（`src/blueprint.ts` の前提条件も確認）
4. 必要なら `src/report.ts` に確認用 Markdown を追加
5. `docs/blueprint/README.md` の進捗表を更新
