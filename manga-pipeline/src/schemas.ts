/**
 * 各エージェントの出力スキーマ（構造化出力 / JSON）。
 * エージェント間の受け渡しはこの型で行うため、コルトスタッフが
 * runs/<id>/ 内の JSON を直接修正してから次の工程に進めることもできる。
 *
 * 構造化出力で使えるよう、optional は使わず nullable と enum で表現する。
 * エージェントを1つ作るたびに、ここへスキーマを追加していく。
 */
import { z } from "zod";

// ───────────── INPUT00: 顧客情報収集（Step 0） ─────────────

/** 資料に書かれていない項目は null。推測で埋めない */
const Known = z.string().nullable();

export const ClientProfile = z.object({
  summary: z.string().describe("案件の要約（3文以内）"),

  client: z.object({
    company_name: Known,
    industry: Known,
    size: Known.describe("従業員数・売上規模など"),
    contact_person: Known.describe("担当者名・部署・役職"),
  }),

  needs: z.object({
    message: Known.describe("漫画で何を伝えたいか"),
    problems: z.array(z.string()).describe("顧客が解決したい課題"),
    desired_outcome: Known.describe("読者に取ってほしい行動・感じてほしいこと"),
  }),

  theme: z.object({
    direction: Known.describe("作品の方向性"),
    genre: Known,
    world: Known.describe("世界観・舞台"),
    tone: Known.describe("トーン（明るい、真面目、コミカル等）"),
  }),

  target: z.object({
    age_range: Known,
    gender: Known,
    media: Known.describe("掲載媒体（Web、冊子、SNS等）"),
    distribution_format: Known.describe("配信形式（縦読み、見開き、PDF等）"),
  }),

  budget_schedule: z.object({
    pages: Known,
    deadline: Known,
    revision_count: Known.describe("修正回数"),
    budget: Known,
  }),

  style_reference: z.object({
    preferred_style: Known.describe("好みの画風"),
    references: z.array(z.string()).describe("参考作品・他社事例"),
    avoid: z.array(z.string()).describe("避けたい表現・NG事項"),
  }),

  assumptions: z
    .array(z.object({ field: z.string(), assumption: z.string(), reason: z.string() }))
    .describe("資料から推測した項目（確定扱いにしない）"),

  missing_items: z
    .array(
      z.object({
        field: z.string().describe("例: budget_schedule.deadline"),
        priority: z.enum(["required", "recommended"]),
        question: z.string().describe("顧客にそのまま聞ける質問文"),
      }),
    )
    .describe("不足している情報と、顧客への確認質問"),

  ready_for_story: z
    .boolean()
    .describe("required の不足がなく、STORYチームが企画を始められる状態なら true"),
});
export type ClientProfile = z.infer<typeof ClientProfile>;
