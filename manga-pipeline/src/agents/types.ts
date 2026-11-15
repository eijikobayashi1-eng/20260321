import type { z } from "zod";
import type { Effort } from "../llm.js";
import type { ClientProfile } from "../schemas.js";

/** 体系図のチーム区分 */
export type Team = "INPUT" | "STORY" | "APPROVAL" | "VISUAL" | "CSP";

/**
 * パイプライン全体で共有される成果物。
 * エージェントを1つ作るたびに、ここへ出力型を追加していく。
 */
export interface Outputs {
  INPUT00?: ClientProfile;
}
export type AgentId = keyof Outputs;

export interface PipelineContext {
  runDir: string;
  /** 投入された資料（ヒアリングメモ等）の本文 */
  source: string;
  outputs: Outputs;
}

/** Claude を呼び出すエージェント */
export interface LlmAgent<S extends z.ZodType = z.ZodType> {
  id: AgentId;
  team: Team;
  name: string;
  /** 前提となる前工程の成果物 */
  requires: AgentId[];
  effort: Effort;
  schema: S;
  rolePrompt: string;
  buildInput(ctx: PipelineContext): string;
  /** --mock 実行時（APIキー不要の動作確認用）のダミー出力 */
  mock(ctx: PipelineContext): z.infer<S>;
}

export type Agent = LlmAgent;

/** 前工程の成果物を取り出す（なければ明確なエラー） */
export function need<K extends AgentId>(ctx: PipelineContext, id: K): NonNullable<Outputs[K]> {
  const v = ctx.outputs[id];
  if (v == null) throw new Error(`${id} の成果物がありません。先に ${id} を実行してください。`);
  return v as NonNullable<Outputs[K]>;
}

export const json = (label: string, value: unknown) =>
  `<${label}>\n${JSON.stringify(value, null, 2)}\n</${label}>`;
