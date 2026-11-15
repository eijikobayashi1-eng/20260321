const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, PageBreak, Footer, Header, PageNumber,
  TableOfContents,
} = require("docx");

const FONT = "Meiryo";
const MONO = "MS Gothic";
const NAVY = "1A3D7C";
const GOLD = "FFD700";
const PAGE_W = 11906, MARGIN = 1300, CONTENT_W = PAGE_W - MARGIN * 2; // A4

// ── helpers ──
const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const p = (children, o = {}) =>
  new Paragraph({ children: typeof children === "string" ? [t(children)] : children, spacing: { after: 120, line: 320 }, ...o });
const h1 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(s)] });
const h2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(s)] });
const h3 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(s)] });
const bullet = (children, level = 0) =>
  new Paragraph({ numbering: { reference: "bullets", level }, children: typeof children === "string" ? [t(children)] : children, spacing: { after: 60, line: 300 } });
let numRef = 0;
const numbered = (items, start = 1) => {
  const ref = `num${numRef++}`;
  numberingConfigs.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", start, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 360 } } } }] });
  return items.map((it) => new Paragraph({ numbering: { reference: ref, level: 0 }, children: typeof it === "string" ? [t(it)] : it, spacing: { after: 60, line: 300 } }));
};
const code = (lines) =>
  lines.map((l, i) =>
    new Paragraph({
      children: [new TextRun({ text: l || " ", font: MONO, size: 19 })],
      shading: { type: ShadingType.CLEAR, fill: "F0F4F8", color: "auto" },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: NAVY, space: 8 },
        ...(i === 0 ? { top: { style: BorderStyle.SINGLE, size: 2, color: "F0F4F8", space: 4 } } : {}),
        ...(i === lines.length - 1 ? { bottom: { style: BorderStyle.SINGLE, size: 2, color: "F0F4F8", space: 4 } } : {}),
      },
      indent: { left: 200 },
      spacing: { after: i === lines.length - 1 ? 160 : 0, line: 280 },
    }),
  );
const note = (label, text, fill = "FFF9E6", line = GOLD) =>
  new Paragraph({
    children: [t(label + "　", { bold: true, color: "B45309" }), t(text)],
    shading: { type: ShadingType.CLEAR, fill, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: line, space: 8 } },
    indent: { left: 200, right: 200 },
    spacing: { before: 80, after: 160, line: 300 },
  });
const warn = (text) => note("⚠ 注意", text, "FEF2F2", "DC2626");

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D3E3" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widthsRatio) {
  const total = widthsRatio.reduce((a, b) => a + b, 0);
  const widths = widthsRatio.map((r) => Math.floor((CONTENT_W * r) / total));
  widths[widths.length - 1] = CONTENT_W - widths.slice(0, -1).reduce((a, b) => a + b, 0);
  const cell = (text, i, head) =>
    new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: head ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      children: String(text).split("\n").map((line) =>
        new Paragraph({ children: [t(line, { size: 19, bold: head, color: head ? "FFFFFF" : "2C2C2C" })], spacing: { after: 0, line: 280 } }),
      ),
    });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 120 } });
const numberingConfigs = [
  {
    reference: "bullets",
    levels: [
      { level: 0, format: LevelFormat.BULLET, text: "●", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 300 } }, run: { color: NAVY, size: 14 } } },
      { level: 1, format: LevelFormat.BULLET, text: "－", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 960, hanging: 300 } } } },
    ],
  },
];

// ── content ──
const children = [];

// 表紙
children.push(
  new Paragraph({ children: [], spacing: { before: 2400 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("コルト AIエージェント", { size: 40, bold: true, color: NAVY })], spacing: { after: 120 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("漫画制作パイプライン 操作マニュアル", { size: 40, bold: true, color: NAVY })], spacing: { after: 360 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 12 }, bottom: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 12 } },
    children: [t("MANGA00（漫画制作管理）・INPUT00（顧客情報収集）編", { size: 28, bold: true, color: "B45309" })],
    spacing: { after: 360 },
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("第1版（試作版）", { size: 24 })], spacing: { after: 1600 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("2026年11月15日", { size: 22, color: "555555" })], spacing: { after: 80 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("コルト株式会社 × ベンチャーマネジメント（小林英二）", { size: 22, color: "555555" })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// 目次
children.push(
  new Paragraph({ children: [t("目次", { size: 30, bold: true, color: NAVY })], spacing: { after: 200 } }),
  new Paragraph({ children: [t("1. このマニュアルについて", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("2. 全体像", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("3. エージェントの説明", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("　3-1. INPUT00 顧客情報収集（Step 0）", { size: 22, color: "555555" })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("　3-2. MANGA00 漫画制作管理（オーケストレーター）", { size: 22, color: "555555" })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("4. 準備（はじめに1回だけ）", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("5. 使い方", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("6. 作られるファイル", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("7. 業務の流れ（例）", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("8. 設定の変更", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("9. 困ったとき", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("10. 現状の制約と今後の予定", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [t("付録. 資料の保存場所", { size: 22, bold: true })], spacing: { after: 100 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "C9D3E3", space: 2 } } }),
  new Paragraph({ children: [new PageBreak()] }),
);

// 1
children.push(
  h1("1. このマニュアルについて"),
  p("このマニュアルは、コルト AIエージェントエコシステム体系図にもとづいて開発中の「漫画制作パイプライン」のうち、現在までに作成した2つのエージェントの使い方をまとめたものです。"),
  table(["対象", "内容"], [
    ["MANGA00", "漫画制作管理エージェント（オーケストレーター）。全エージェントの指揮塔"],
    ["INPUT00", "顧客情報収集エージェント（Step 0）。MANGA00 が最初に起動する"],
  ], [1, 4]),
  gap(),
  warn("本書の内容は「試作版」です。プログラムは完成していますが、実際の Claude（AI）での動作確認はまだ行っていません（API キー未設定のため）。動作は試運転モード（モック）でのみ確認済みです。"),
  h2("1-1. 開発の方針"),
  bullet("体系図（manga_agent_ecosystem_orgchart.html）を設計図とし、すべてのエージェントをこれに合わせて作る"),
  bullet("エージェントは1つずつ作り、確認をもらってから次へ進む"),
  bullet("使用AIは体系図の指定どおり Claude（Sonnet）。すべて仮設定で、製作者会議で確定する"),
);

// 2
children.push(
  h1("2. 全体像"),
  h2("2-1. 体系図とエージェントの関係"),
  p("体系図では、人間（大野社長＋コルトスタッフ）の下に MANGA00 が司令塔として立ち、まず Step 0 として INPUT00 を起動します。その後、STORY → 制作承認（WF1・WF2）→ VISUAL → CSP の順にチームを動かします。"),
  ...code([
    "大野社長 ＋ コルトスタッフ（監修・方針判断・承認判断）",
    "   │",
    "   └─ MANGA00 漫画制作管理（オーケストレーター）",
    "        │",
    "        ├─ Step 0: INPUT00 顧客情報収集   ← 実装済み",
    "        ├─ STORYチーム: STORY01 → 02 → 03",
    "        ├─ 制作承認: WF1 営業提案書 / WF2 稟議承認書（GATE）",
    "        ├─ VISUALチーム: VISUAL01 → 02 → 03",
    "        └─ CSPチーム: CSP01 → 02 → 03 → 完成",
  ]),
  h2("2-2. 実装状況"),
  table(["#", "エージェント", "状態"], [
    ["1", "INPUT00 顧客情報収集", "✅ 試作版 完成"],
    ["2", "MANGA00 オーケストレーター", "✅ 試作版 完成（エージェントが増えるたびに更新）"],
    ["3", "STORY01 企画立案", "未着手（次に作成予定）"],
    ["4", "STORY02 ネーム・コマ割り生成", "未着手"],
    ["5", "STORY03 ストーリー品質チェック", "未着手"],
    ["6", "PROP01 営業提案書（WF1）", "未着手"],
    ["7", "PROP02 稟議承認書（WF2 GATE）", "未着手"],
    ["8", "VISUAL01〜03", "未着手（外部画像AIとの連携方法を要検討）"],
    ["9", "CSP01〜03", "未着手（CSPマクロとの連携方法を要検討）"],
  ], [0.5, 3, 4]),
);

// 3
children.push(
  h1("3. エージェントの説明"),
  h2("3-1. INPUT00 顧客情報収集（Step 0）"),
  p("ヒアリングメモ・メール・議事録などの資料を読み、顧客情報を体系図の6項目に整理します。顧客情報が曖昧なまま制作を始めると方向性がズレてやり直しになるため、「わかっていること」と「わかっていないこと」をはっきり分けることを最も重視しています。"),
  h3("整理する6項目"),
  table(["項目", "内容"], [
    ["1. クライアント基本情報", "社名・業種・規模・担当者"],
    ["2. 顧客ニーズ・課題", "何を伝えたいか・解決したい問題・読後に期待する行動"],
    ["3. テーマ・ジャンル", "作品の方向性・ジャンル・世界観・トーン"],
    ["4. ターゲット読者", "年齢層・性別・掲載媒体・配信形式"],
    ["5. 予算・スケジュール", "ページ数・納期・修正回数・予算"],
    ["6. 参考スタイル", "好みの画風・参考作品や他社事例・避けたい表現"],
  ], [2, 4]),
  h3("INPUT00 の約束ごと"),
  bullet("資料に書かれていない項目は推測で埋めず「（不明）」とする"),
  bullet("推測できる内容は「推測した項目（要確認）」として、根拠と一緒に別に書く"),
  bullet("資料内の数値・固有名詞は原文どおりに転記する"),
  bullet("「追加ヒアリング」の回答があれば、元の資料より優先して反映する"),
  h3("不足していると感じたら、必ず質問する"),
  p("次のものはすべて「不足」とみなし、顧客への確認質問を作ります。"),
  bullet("書かれていない項目"),
  bullet("曖昧な表現（「〜くらい」「未定」「要相談」「後で送る」「課内で確認」など）"),
  bullet("資料の中で矛盾している内容"),
  bullet("企画やネームを作るときに判断に迷いそうな点（例：実在の店舗名を出してよいか）"),
  p("質問は1問につき1つのことだけを聞き、答えやすいように選択肢や例を添えます。"),
  note("例", "「掲載形式は、スマホ向けの縦スクロールと、冊子のような見開きのどちらをご希望でしょうか。」"),
  h3("必須項目と「STORYチームへの引き渡し」判定"),
  table(["区分", "項目", "扱い"], [
    ["必須", "伝えたいこと／ターゲット読者／ページ数／納期／掲載媒体・配信形式", "1つでも不足（曖昧を含む）があれば STORY チームに進まない"],
    ["できれば確認", "上記以外", "重要なものから最大5件を質問する"],
  ], [1.2, 3.5, 3]),
  gap(),
  note("補足", "掲載媒体・配信形式を必須にしているのは、縦読みか見開きかでコマ割りが大きく変わるためです。不要であれば外せます。"),

  h2("3-2. MANGA00 漫画制作管理（オーケストレーター）"),
  p("案件の状況（どの成果物があるか、資料が更新されたか、承認済みか）を読み、次の一手を判断します。判断は次の3種類です。"),
  table(["判断", "内容"], [
    ["エージェントを動かす", "動かせるエージェントの中から、次に動かすものを選んで実行する"],
    ["人に依頼する", "顧客・コルトスタッフ・稟議承認者のいずれかに対応を依頼して一時停止する"],
    ["完了", "全工程が終わったら終了する"],
  ], [1.5, 4]),
  h3("ルールはプログラムで強制しています"),
  p("MANGA00（AI）の判断は、実行前にプログラムで次の点を確認します。ルールに合わない判断は実行せず「差し止め」て止まり、スタッフに確認を依頼します。"),
  ...numbered([
    "まだ作っていないエージェントではないか",
    "前の工程の成果物が揃っているか（体系図の順番）",
    "GATE を通過しているか（WF2 稟議承認の前は VISUAL・CSP の本制作に着手しない）",
    "資料も指示も変わらないまま、同じエージェントを続けて動かそうとしていないか",
  ]),
  h3("MANGA00 が止まる場面"),
  table(["場面", "依頼先", "対応"], [
    ["顧客情報が足りない", "その場の担当者 → 顧客", "その場で質問に答える。答えられない質問は顧客に確認"],
    ["次のエージェントが未実装", "コルトスタッフ", "それまでの成果物をもとに手作業で進める"],
    ["WF2 稟議承認待ち", "稟議承認者", "承認が出たら approve コマンドで記録"],
    ["判断がルール違反（差し止め）", "コルトスタッフ", "内容を確認し、資料や成果物を直してから再開"],
  ], [2.2, 1.8, 3.5]),
);

// 4
children.push(
  h1("4. 準備（はじめに1回だけ）"),
  h2("4-1. 必要なもの"),
  table(["もの", "説明"], [
    ["パソコン", "Windows / Mac どちらでも可"],
    ["Node.js（バージョン20以上）", "プログラムを動かすためのソフト。nodejs.org から無料で入手"],
    ["プログラム一式", "GitHub リポジトリ（eijikobayashi1-eng/20260321）の manga-pipeline フォルダ"],
    ["Claude API キー", "Claude（AI）を使うための鍵。Anthropic のサイトで発行"],
  ], [2, 4]),
  h2("4-2. セットアップ手順"),
  ...numbered([
    "manga-pipeline フォルダでターミナル（Windows は PowerShell）を開く",
    "次のコマンドで必要な部品を入れる",
  ]),
  ...code(["npm install"]),
  ...numbered(["Claude API キーを環境変数 ANTHROPIC_API_KEY に設定する（Windows の例）"], 3),
  ...code(['$env:ANTHROPIC_API_KEY = "ここにAPIキー"']),
  warn("API キーはパスワードと同じです。チャットやメール、資料に貼り付けないでください。"),
  h2("4-3. コルトスタイルガイドの記入"),
  p("config/colt-style.md は全エージェントが必ず読む「コルトらしさ」の決まりごとです。現在は雛形で、「要記入」の箇所が空欄です。社長・制作スタッフに確認して埋めるほど、全エージェントの出力がコルトらしくなります。"),
  bullet("会社としての基本姿勢・大切にしている価値観"),
  bullet("標準のトーン（明るさ、ユーモアの度合い）"),
  bullet("禁止事項（過去の案件で NG になった表現など）"),
  bullet("画風（LoRA のトリガーワード、線の太さ、頭身など）"),
);

// 5
children.push(
  h1("5. 使い方"),
  p("コマンドはすべて manga-pipeline フォルダで、ターミナルに入力します。"),
  h2("5-1. 案件を始める（start）"),
  p("ヒアリングメモ・メール・議事録などを1つのテキストファイル（.md または .txt）にまとめ、次のコマンドで MANGA00 に渡します。"),
  ...code(["npm run manga -- start ヒアリングメモ.md"]),
  p("MANGA00 が INPUT00 を動かし、顧客情報を整理します。案件ごとに runs フォルダの中に「日時」の名前のフォルダ（案件ID。例：20261115-103000）が作られます。"),
  h2("5-2. その場の質問に答える"),
  p("顧客情報が足りない・曖昧だと MANGA00 が判断すると、ターミナルで1問ずつ質問します。"),
  ...code([
    "❓ 制作開始前のご確認事項",
    "Q1/3. 掲載形式は、スマホ向けの縦スクロールと、冊子のような見開きの",
    "      どちらをご希望でしょうか。",
    "  回答 > 縦スクロール",
    "Q2/3. 公開をご予定されている時期（納期）をお教えください。",
    "  回答 > （わからないので何も入力せず Enter）",
  ]),
  bullet("わかる質問に答えると、資料（source.md）の末尾に「追加ヒアリング」として自動で追記され、顧客情報を作り直して先へ進みます。"),
  bullet("わからない質問は何も入力せずに Enter で飛ばします。飛ばした質問は顧客への確認事項として NEXT_ACTION.md に残ります。"),
  h2("5-3. 顧客から回答が来たら（continue）"),
  ...numbered([
    "runs/案件ID/source.md を開き、末尾に顧客の回答を書き足して保存する",
    "次のコマンドで MANGA00 を再開する",
  ]),
  ...code(["npm run manga -- continue 案件ID"]),
  p("MANGA00 は資料が更新されたことに自動で気づき、INPUT00 で顧客情報を作り直します。"),
  h2("5-4. 進み具合を見る（status）"),
  ...code(["npm run manga -- status 案件ID"]),
  p("全エージェントについて「✅ 完了」「▶ 実行可能」「－ 未実装」「🔒 承認待ち」「△ 資料更新あり（要再実行）」などが一覧で表示されます。"),
  h2("5-5. 稟議の承認を記録する（approve）"),
  p("WF2（稟議承認書）で顧客社内の承認が得られたら、承認を記録します。記録するまで VISUAL・CSP の本制作には進めません。"),
  ...code(["npm run manga -- approve 案件ID WF2 --by 佐藤課長 --note 11/30稟議承認"]),
  note("補足", "WF2 を作る PROP02 はまだ未実装です。approve コマンドは先に用意しています。"),
  h2("5-6. エージェントを1つだけ動かす（run / rerun）"),
  p("MANGA00 を通さずに、エージェントを単体で動かすこともできます。"),
  ...code(["npm run manga -- run INPUT00 ヒアリングメモ.md      （新しい案件として）", "npm run manga -- rerun INPUT00 案件ID              （既存の案件で再実行）"]),
  h2("5-7. 試運転（--mock）"),
  p("コマンドの最後に --mock を付けると、Claude（AI）を使わずにダミーの出力で流れだけを確認できます。API キーがなくても動き、料金もかかりません。"),
  ...code(["npm run manga -- start examples/hearing-memo.md --mock"]),
  h2("5-8. コマンド早見表"),
  table(["やりたいこと", "コマンド"], [
    ["案件を始める", "npm run manga -- start 資料.md"],
    ["人の対応後に再開する", "npm run manga -- continue 案件ID"],
    ["進み具合を見る", "npm run manga -- status 案件ID"],
    ["稟議承認を記録する", "npm run manga -- approve 案件ID WF2 --by 承認者名"],
    ["エージェントを単体で動かす", "npm run manga -- run INPUT00 資料.md"],
    ["既存案件でやり直す", "npm run manga -- rerun INPUT00 案件ID"],
    ["実装済みエージェントの一覧", "npm run manga -- list"],
    ["試運転（AIを使わない）", "コマンドの最後に --mock"],
    ["その場で質問させない", "コマンドの最後に --no-ask"],
  ], [2.2, 4]),
);

// 6
children.push(
  h1("6. 作られるファイル"),
  p("案件ごとに runs/案件ID/ フォルダに次のファイルが作られます。"),
  table(["ファイル", "内容", "主に見る人"], [
    ["source.md", "投入した資料のコピー。追加ヒアリングの回答もここに追記される", "担当者"],
    ["INPUT00.md", "顧客情報シート（6項目・推測した項目・顧客への確認事項）", "担当者・社長"],
    ["INPUT00.json", "顧客情報のデータ（次のエージェントに渡す）", "（プログラム）"],
    ["NEXT_ACTION.md", "次にやること。誰に・何を依頼するか、再開のコマンド", "担当者"],
    ["MANGA00_log.md", "MANGA00 の判断の経緯（状況・理由・結果）", "担当者・社長"],
    ["state.json", "案件の状態（実行記録・承認・判断履歴）", "（プログラム）"],
  ], [1.8, 4, 1.5]),
);

// 7
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [t("7. 業務の流れ（例）")] }),
  p("付属のサンプル資料（examples/hearing-memo.md：架空の「みなと市 観光PR漫画」案件）を使った場合の流れです。", { keepNext: true }),
  table(["手順", "誰が", "何をする"], [
    ["1", "営業担当", "ヒアリング後、メモをテキストファイルにまとめて start を実行"],
    ["2", "MANGA00", "INPUT00 を起動し、顧客情報を6項目に整理"],
    ["3", "MANGA00", "「10ページくらい」「縦スクロールかは要相談」など曖昧な点を、その場で担当者に質問"],
    ["4", "営業担当", "わかる質問に回答。わからない質問は Enter で飛ばす"],
    ["5", "MANGA00", "回答を資料に追記し、顧客情報を作り直す"],
    ["6", "営業担当", "NEXT_ACTION.md に残った質問を顧客にメール等で確認"],
    ["7", "営業担当", "顧客の回答を source.md に追記し、continue で再開"],
    ["8", "MANGA00", "必須情報が揃えば「STORYチームへ引き渡し可」と判定（現在は STORY01 未実装のため、ここで止まる）"],
  ], [0.7, 1.4, 5]),
);

// 8
children.push(
  h1("8. 設定の変更"),
  table(["変えたいこと", "方法"], [
    ["コルトらしさの決まりごと", "config/colt-style.md を編集"],
    ["使用する AI モデル", "環境変数 MANGA_MODEL を設定（既定：claude-sonnet-5-5）"],
    ["その場で質問させない", "コマンドに --no-ask を付ける（確認事項の書き出しだけにする）"],
    ["各エージェントへの指示内容", "src/agents フォルダ内のファイル（開発者が編集）"],
  ], [2, 4]),
  gap(),
  note("補足", "AI が安全上の理由で応答を断った場合は、自動で別のモデルに切り替えて処理を続ける設定にしています。"),
);

// 9
children.push(
  h1("9. 困ったとき"),
  table(["症状", "原因と対処"], [
    ["「Could not resolve authentication method」と出る", "API キーが設定されていません。4-2 の手順で設定してください"],
    ["「401 invalid x-api-key」と出る", "API キーが間違っています。キーを確認してください"],
    ["「差し止め」と表示されて止まった", "MANGA00 の判断がルールに合わなかったため止めています。NEXT_ACTION.md の内容を確認し、資料や成果物を直してから continue してください"],
    ["「STORY01（企画立案）が未実装です」で止まる", "正常です。現在は INPUT00 の次のエージェントがまだないため、ここで止まります"],
    ["同じような質問が繰り返される", "飛ばした質問は顧客への確認事項に残ります。顧客の回答を source.md に追記してから continue してください"],
    ["「出力が max_tokens に達しました」と出る", "資料が非常に長い場合に起きます。資料を分けるか短くしてください"],
  ], [2.5, 4.5]),
);

// 10
children.push(
  h1("10. 現状の制約と今後の予定"),
  h2("10-1. まだ確認・対応できていないこと"),
  ...numbered([
    "実際の Claude（AI）での動作確認（API キー設定後に実施）",
    "実際のヒアリングメモ2〜3件での試験と、スタッフによる出力内容の確認",
    "コルトスタイルガイドの記入",
    "操作はターミナルのみ（スタッフ向けの画面はない）",
    "資料はテキストのみ対応（PDF・Word・メールの直接読み込みは未対応）",
    "MANGA00 のチーム間連携・差し戻し判断は、後続エージェントの完成後に検証",
  ]),
  h2("10-2. 検討が必要な点"),
  p("体系図には「WF2 承認前は VISUAL 着手禁止」とある一方で、「キャラクター画像を1〜2枚作成してから WF1（営業提案書）に組み込む」という判断例もあります。現在は前者のルールで承認前の VISUAL をすべて止めています。提案用サンプルを例外にするかは、VISUAL チームを作る段階で決める予定です。"),
  h2("10-3. 完成までの手順"),
  ...numbered([
    "API キーを設定し、実際の Claude で動かす",
    "実際のヒアリングメモで試し、顧客情報シートと質問をスタッフが確認する",
    "指摘をもとに INPUT00 の指示文・必須項目を調整する",
    "コルトスタイルガイドを埋める",
  ]),
  h2("10-4. 次に作るエージェント"),
  p("STORY01（企画立案）→ STORY02（ネーム・コマ割り）→ STORY03（品質チェック）→ PROP01（営業提案書）→ PROP02（稟議承認書）→ VISUAL → CSP の順に、1つずつ作成します。"),
);

// 付録
children.push(
  h1("付録. 資料の保存場所"),
  table(["資料", "保存場所"], [
    ["体系図（設計図）", "Google ドライブ「コルト ＞ AIエージェント化開発会議」\nGitHub：docs/blueprint/manga_agent_ecosystem_orgchart.html"],
    ["本マニュアル", "Google ドライブ「コルト ＞ AIエージェント化開発会議」"],
    ["プログラム", "GitHub：eijikobayashi1-eng/20260321 の manga-pipeline フォルダ"],
  ], [1.6, 5]),
  gap(),
  p("体系図を更新した際は、GitHub と同時に Google ドライブの「AIエージェント化開発会議」フォルダにも保存するルールです。"),
);

const doc = new Document({
  creator: "ベンチャーマネジメント",
  title: "コルト AIエージェント 漫画制作パイプライン 操作マニュアル",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 30, bold: true, color: NAVY },
        paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 25, bold: true, color: NAVY },
        paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22, bold: true, color: "B45309" },
        paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: numberingConfigs },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1300, bottom: 1300, left: MARGIN, right: MARGIN } }, titlePage: true },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [t("コルト AIエージェント 操作マニュアル（MANGA00・INPUT00）", { size: 16, color: "999999" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "999999" })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2], buf);
  console.log("作成:", process.argv[2]);
});
