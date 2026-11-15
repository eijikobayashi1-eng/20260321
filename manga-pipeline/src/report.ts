/**
 * 成果物をスタッフが読める Markdown に変換する（監修・顧客確認用）。
 */
import type { AgentId, Outputs } from "./agents/types.js";
import type { ClientProfile } from "./schemas.js";

const v = (s: string | null) => s ?? "**（不明）**";
const list = (xs: string[]) => (xs.length ? xs.join(" / ") : "**（不明）**");

function clientProfileMd(p: ClientProfile): string {
  const rows = (pairs: [string, string][]) => ["| 項目 | 内容 |", "|---|---|", ...pairs.map(([k, x]) => `| ${k} | ${x} |`)].join("\n");
  const required = p.missing_items.filter((m) => m.priority === "required");
  const recommended = p.missing_items.filter((m) => m.priority === "recommended");
  return [
    "# 顧客情報シート（INPUT00）",
    "",
    `> ${p.summary}`,
    "",
    `**STORYチームへの引き渡し: ${p.ready_for_story ? "✅ 可能" : "⛔ 不可（必須情報の確認が必要）"}**`,
    "",
    "## 1. クライアント基本情報",
    rows([["社名", v(p.client.company_name)], ["業種", v(p.client.industry)], ["規模", v(p.client.size)], ["担当者", v(p.client.contact_person)]]),
    "",
    "## 2. 顧客ニーズ・課題",
    rows([["伝えたいこと", v(p.needs.message)], ["課題", list(p.needs.problems)], ["読後に期待する行動", v(p.needs.desired_outcome)]]),
    "",
    "## 3. テーマ・ジャンル",
    rows([["方向性", v(p.theme.direction)], ["ジャンル", v(p.theme.genre)], ["世界観", v(p.theme.world)], ["トーン", v(p.theme.tone)]]),
    "",
    "## 4. ターゲット読者",
    rows([["年齢層", v(p.target.age_range)], ["性別", v(p.target.gender)], ["媒体", v(p.target.media)], ["配信形式", v(p.target.distribution_format)]]),
    "",
    "## 5. 予算・スケジュール",
    rows([["ページ数", v(p.budget_schedule.pages)], ["納期", v(p.budget_schedule.deadline)], ["修正回数", v(p.budget_schedule.revision_count)], ["予算", v(p.budget_schedule.budget)]]),
    "",
    "## 6. 参考スタイル",
    rows([["好みの画風", v(p.style_reference.preferred_style)], ["参考事例", list(p.style_reference.references)], ["避けたい表現", list(p.style_reference.avoid)]]),
    "",
    "## 推測した項目（要確認）",
    p.assumptions.length ? p.assumptions.map((a) => `- \`${a.field}\`: ${a.assumption}（根拠: ${a.reason}）`).join("\n") : "- なし",
    "",
    "## 顧客への確認事項",
    "### 必須",
    required.length ? required.map((m, i) => `${i + 1}. ${m.question}　\`${m.field}\``).join("\n") : "- なし",
    "",
    "### できれば確認",
    recommended.length ? recommended.map((m, i) => `${i + 1}. ${m.question}　\`${m.field}\``).join("\n") : "- なし",
    "",
  ].join("\n");
}

export function toMarkdown(id: AgentId, outputs: Outputs): string | null {
  switch (id) {
    case "INPUT00":
      return outputs.INPUT00 ? clientProfileMd(outputs.INPUT00) : null;
    default:
      return null;
  }
}
