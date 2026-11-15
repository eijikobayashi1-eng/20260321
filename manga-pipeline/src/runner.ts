/**
 * MANGA00（オーケストレーター）の土台。
 * いまは「エージェントを1つ実行して、成果物を runs/<id>/ に保存する」だけを担う。
 * エージェントが増えたら、ここに工程順の自動連携と監修ゲートを足していく。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTS } from "./agents/index.js";
import type { AgentId, Outputs, PipelineContext } from "./agents/types.js";
import { callAgent } from "./llm.js";
import { toMarkdown } from "./report.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RUNS_DIR = path.join(ROOT, "runs");

const SHARED_SYSTEM_BASE = `あなたは漫画制作会社コルトのAIエージェントチームの一員です。
各エージェントは担当工程だけを行い、成果物を次の工程に渡します。全体の指揮は MANGA00（オーケストレーター）が行い、最終的な品質はコルトのプロが監修・修正します。

共通ルール:
- 出力はすべて日本語（画像生成AI向けプロンプトのみ英語）。
- 以下の「コルトスタイルガイド」を常に守る。ガイドと作業指示が矛盾する場合はガイドを優先し、その旨を出力内のメモ欄に書く。
- 入力に書かれていない事実を作らない。不明点は「要確認」と明記する。`;

async function loadSharedSystem(): Promise<string> {
  const guide = await readFile(path.join(ROOT, "config", "colt-style.md"), "utf8");
  return `${SHARED_SYSTEM_BASE}\n\n<colt_style_guide>\n${guide}\n</colt_style_guide>`;
}

export function newRunId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** runs/<id>/ から企画書と既存の成果物を読み込む */
export async function loadContext(runId: string): Promise<PipelineContext> {
  const runDir = path.join(RUNS_DIR, runId);
  const source = await readFile(path.join(runDir, "source.md"), "utf8");
  const outputs: Outputs = {};
  for (const id of Object.keys(AGENTS) as AgentId[]) {
    const f = path.join(runDir, `${id}.json`);
    if (existsSync(f)) (outputs as Record<string, unknown>)[id] = JSON.parse(await readFile(f, "utf8"));
  }
  return { runDir, source, outputs };
}

export async function createRun(sourcePath: string): Promise<PipelineContext> {
  const runId = newRunId();
  const runDir = path.join(RUNS_DIR, runId);
  await mkdir(runDir, { recursive: true });
  const source = await readFile(sourcePath, "utf8");
  await writeFile(path.join(runDir, "source.md"), source);
  return { runDir, source, outputs: {} };
}

export async function runAgent(ctx: PipelineContext, id: AgentId, opts: { mock: boolean }): Promise<string> {
  const agent = AGENTS[id];
  for (const req of agent.requires) {
    if (ctx.outputs[req] == null) throw new Error(`${id} の実行には ${req} の成果物が必要です。`);
  }

  console.log(`▶ ${agent.id}（${agent.name}）を実行中${opts.mock ? "［モック］" : ""}...`);
  const started = Date.now();
  let data: unknown;
  if (opts.mock) {
    data = agent.schema.parse(agent.mock(ctx));
  } else {
    const res = await callAgent({
      agentId: agent.id,
      sharedSystem: await loadSharedSystem(),
      rolePrompt: agent.rolePrompt,
      userContent: agent.buildInput(ctx),
      schema: agent.schema,
      effort: agent.effort,
    });
    data = res.data;
    const u = res.usage;
    console.log(`  tokens: in ${u.input} / out ${u.output} / cache read ${u.cacheRead} / cache write ${u.cacheWrite}（${res.servedBy}）`);
  }

  (ctx.outputs as Record<string, unknown>)[id] = data;
  const out = path.join(ctx.runDir, `${id}.json`);
  await writeFile(out, JSON.stringify(data, null, 2));
  const md = toMarkdown(id, ctx.outputs);
  if (md) {
    await writeFile(path.join(ctx.runDir, `${id}.md`), md);
    console.log(`  スタッフ確認用: ${path.relative(process.cwd(), path.join(ctx.runDir, `${id}.md`))}`);
  }
  console.log(`✔ ${id} 完了（${((Date.now() - started) / 1000).toFixed(1)}秒）→ ${path.relative(process.cwd(), out)}`);
  return out;
}
