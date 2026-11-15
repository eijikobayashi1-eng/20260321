/**
 * エージェント登録簿。設計図（docs/blueprint/manga_agent_ecosystem_orgchart.html）
 * に沿って1つずつ追加していく。進捗は docs/blueprint/README.md を参照。
 */
import type { Agent, AgentId } from "./types.js";
import { INPUT00 } from "./input.js";

export const AGENTS: Record<AgentId, Agent> = {
  INPUT00,
};
