/**
 * INPUT00 — 顧客情報収集エージェント（Step 0）
 *
 * MANGA00 が最初に起動するサブエージェント。
 * ヒアリングメモ・メール・議事録などの資料から顧客情報を6項目に整理し、
 * 不足している情報を「顧客への確認質問」として洗い出す。
 * 成果物は STORY チーム・制作承認チーム（WF1）・各チームへ配布される。
 */
import { ClientProfile } from "../schemas.js";
import type { LlmAgent } from "./types.js";

export const INPUT00: LlmAgent<typeof ClientProfile> = {
  id: "INPUT00",
  team: "INPUT",
  name: "顧客情報収集",
  requires: [],
  effort: "medium",
  schema: ClientProfile,
  rolePrompt: `あなたはコルトの「INPUT00 顧客情報収集エージェント」です。
漫画制作の Step 0 として、渡された資料（ヒアリングメモ、メール、議事録など）から顧客情報を整理します。
あなたの成果物をもとに STORY チームが企画を立て、制作承認チームが営業提案書・稟議承認書を作ります。
情報が曖昧なまま制作が始まると方向性がズレてやり直しになるため、「わかっていること」と「わかっていないこと」をはっきり分けることが最も重要です。

整理する6項目:
1. クライアント基本情報（社名・業種・規模・担当者）
2. 顧客ニーズ・課題（何を伝えたいか・解決したい問題）
3. テーマ・ジャンル（方向性・世界観・トーン）
4. ターゲット読者（年齢層・性別・媒体・配信形式）
5. 予算・スケジュール（ページ数・納期・修正回数）
6. 参考スタイル（好みの画風・他社事例・避けたい表現）

ルール:
- 資料に書かれている内容だけを各欄に入れる。書かれていない欄は null（配列は空）にする。
- 資料から推測できるが明言されていない内容は欄に入れず、assumptions に根拠と一緒に書く。
- 資料内の数値・固有名詞は原文どおりに転記する。
- 資料に「追加ヒアリング」の回答があれば、元の資料より優先して反映する。

不足していると感じたら、必ず質問する:
- 次のものはすべて「不足」とみなし、missing_items に質問を入れる。
  - 書かれていない項目
  - 曖昧な表現（「〜くらい」「未定」「要相談」「後で送る」「課内で確認」など）
  - 資料の中で矛盾している内容
  - 企画やネームを作るときに判断に迷いそうな点（例: 実在の店舗名を出してよいか、マスコットの使い方の制約）
- priority の基準:
  - required: これがないと企画を始められない項目。伝えたいこと、ターゲット読者、ページ数、納期、掲載媒体・配信形式（縦読みか見開きかでコマ割りが変わるため）
  - recommended: あると精度が上がる項目
- 質問は1つにつき1つのことだけを聞き、答えやすいように選択肢や例を添える
  （例: 「掲載形式は、スマホ向けの縦スクロールと、冊子のような見開きのどちらをご希望でしょうか。」）。
- 質問は required をすべて入れたうえで、recommended は重要なものから5件までにする。
- ready_for_story は required の不足（曖昧なものを含む）が1つもないときだけ true。`,
  buildInput: (ctx) =>
    `次の資料から顧客情報を整理してください。\n\n<source_materials>\n${ctx.source}\n</source_materials>`,
  mock: (ctx) => (ctx.source.includes("追加ヒアリング") ? MOCK_READY : MOCK_NOT_READY),
};

const MOCK_NOT_READY: ClientProfile = {
  summary: "（モック）地方信用金庫が、若手向けに資産形成の基礎を伝える漫画を検討している。",
  client: { company_name: "（モック）さくら信用金庫", industry: "金融（信用金庫）", size: null, contact_person: "広報課 田中様" },
  needs: {
    message: "NISAなど資産形成の基本",
    problems: ["20〜30代の来店が少ない"],
    desired_outcome: null,
  },
  theme: { direction: "親しみやすい学習漫画", genre: null, world: null, tone: "明るい" },
  target: { age_range: "20〜30代", gender: null, media: "Webサイト", distribution_format: null },
  budget_schedule: { pages: "8ページ", deadline: null, revision_count: null, budget: null },
  style_reference: { preferred_style: null, references: [], avoid: ["投資を煽る表現"] },
  assumptions: [{ field: "theme.genre", assumption: "お仕事・日常系", reason: "学習漫画で親しみやすさ重視のため" }],
  missing_items: [
    { field: "budget_schedule.deadline", priority: "required", question: "公開をご予定されている時期（納期）をお教えいただけますでしょうか。" },
    { field: "needs.desired_outcome", priority: "recommended", question: "読み終えた方に、どのような行動を取っていただきたいとお考えでしょうか。" },
  ],
  ready_for_story: false,
};

/** 追加ヒアリング後のモック: 必須情報が揃った状態 */
const MOCK_READY: ClientProfile = {
  ...MOCK_NOT_READY,
  summary: "（モック・回答反映済み）地方信用金庫が、若手向けに資産形成の基礎を伝える漫画を作る。",
  budget_schedule: { ...MOCK_NOT_READY.budget_schedule, deadline: "（回答より）" },
  missing_items: MOCK_NOT_READY.missing_items.filter((m) => m.priority !== "required"),
  ready_for_story: true,
};
