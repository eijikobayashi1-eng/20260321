/**
 * 設計図（docs/blueprint/manga_agent_ecosystem_orgchart.html）をコードにしたもの。
 * MANGA00 はこの一覧を見て「次にどのエージェントを動かせるか」を判断する。
 * 前提条件と GATE はコード側でも強制し、MANGA00 の判断ミスでルールが破られないようにする。
 */
export type BlueprintId =
  | "INPUT00"
  | "STORY01" | "STORY02" | "STORY03"
  | "PROP01" | "PROP02"
  | "VISUAL01" | "VISUAL02" | "VISUAL03"
  | "CSP01" | "CSP02" | "CSP03";

export type GateId = "WF2";

export interface BlueprintEntry {
  id: BlueprintId;
  team: string;
  name: string;
  role: string;
  /** 実行前に揃っている必要がある成果物 */
  requires: BlueprintId[];
  /** 実行前に人間の承認が必要な GATE */
  gate: GateId | null;
}

export const BLUEPRINT: BlueprintEntry[] = [
  { id: "INPUT00", team: "Step 0", name: "顧客情報収集", role: "顧客情報を6項目に整理し、不足情報を確認質問にする。他のどのチームより先に動く", requires: [], gate: null },
  { id: "STORY01", team: "ストーリー生成", name: "企画立案", role: "INPUT00 の顧客情報をもとに企画・テーマを設計", requires: ["INPUT00"], gate: null },
  { id: "STORY02", team: "ストーリー生成", name: "ネーム・コマ割り生成", role: "企画 → コマ割り変換・セリフ最適化", requires: ["STORY01"], gate: null },
  { id: "STORY03", team: "ストーリー生成", name: "ストーリー品質チェック", role: "整合性・顧客要件との合致・ブランド一貫性チェック", requires: ["INPUT00", "STORY02"], gate: null },
  { id: "PROP01", team: "制作承認 WF1", name: "営業提案書", role: "顧客情報＋STORYの企画方向性から提案資料を作る。STORYが進んだ段階で起動", requires: ["INPUT00", "STORY01"], gate: null },
  { id: "PROP02", team: "制作承認 WF2", name: "稟議承認書", role: "顧客社内の上司への稟議に耐える承認資料。ネーム完成後に起動。曖昧表現・TBD禁止", requires: ["INPUT00", "STORY03"], gate: null },
  { id: "VISUAL01", team: "ビジュアル生成", name: "キャラクター画像生成", role: "LoRA適用・プロンプト設計・スタイル管理", requires: ["STORY03"], gate: "WF2" },
  { id: "VISUAL02", team: "ビジュアル生成", name: "背景・世界観生成", role: "背景画像・コルト独自スタイル形成", requires: ["STORY03"], gate: "WF2" },
  { id: "VISUAL03", team: "ビジュアル生成", name: "描画仕上げ・AI補正", role: "ライン補正・トーン処理", requires: ["VISUAL01", "VISUAL02"], gate: "WF2" },
  { id: "CSP01", team: "CSP統合", name: "コマ割り作成", role: "ネーム → コマ構成・ページガイドライン", requires: ["STORY03"], gate: "WF2" },
  { id: "CSP02", team: "CSP統合", name: "セリフ・フキダシ配置", role: "フキダシ配置・写植・スクリーントーン", requires: ["CSP01"], gate: "WF2" },
  { id: "CSP03", team: "CSP統合", name: "CSP最終出力管理", role: "PSDレイヤー管理・最終品質チェック", requires: ["CSP02", "VISUAL03"], gate: "WF2" },
];

export const GATES: Record<GateId, { name: string; description: string }> = {
  WF2: {
    name: "WF2 稟議承認",
    description: "顧客社内の稟議承認（PROP02 の資料で承認を得る）。承認前は VISUAL・CSP の本制作に着手禁止",
  },
};

export const blueprintEntry = (id: string) => BLUEPRINT.find((b) => b.id === id);
