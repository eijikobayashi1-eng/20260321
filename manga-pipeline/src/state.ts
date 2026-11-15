/**
 * run の状態（runs/<id>/state.json）。
 * どのエージェントがいつ・どの資料で実行されたか、GATE の承認、MANGA00 の判断履歴を記録する。
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GateId } from "./blueprint.js";

export interface AgentRunRecord {
  at: string;
  /** 実行時の資料（source.md）のハッシュ。資料が追記されたら古い成果物とわかる */
  sourceHash: string;
  instructions: string | null;
}

export interface Approval {
  at: string;
  by: string;
  note: string;
}

export interface DecisionLog {
  at: string;
  action: string;
  agent_id: string | null;
  situation: string;
  reason: string;
  result: string;
}

export interface RunState {
  agentRuns: Record<string, AgentRunRecord>;
  approvals: Partial<Record<GateId, Approval>>;
  decisions: DecisionLog[];
}

export const hashSource = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

const statePath = (runDir: string) => path.join(runDir, "state.json");

export async function loadState(runDir: string): Promise<RunState> {
  const f = statePath(runDir);
  if (!existsSync(f)) return { agentRuns: {}, approvals: {}, decisions: [] };
  return JSON.parse(await readFile(f, "utf8")) as RunState;
}

export async function saveState(runDir: string, state: RunState): Promise<void> {
  await writeFile(statePath(runDir), JSON.stringify(state, null, 2));
}
