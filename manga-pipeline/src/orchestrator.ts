/**
 * MANGA00 の実行ループ。
 *
 *   1. run の状況（設計図のどこまで進んだか）をまとめる
 *   2. MANGA00 に次の一手を判断させる
 *   3. 判断をコードでチェック（実装済みか・前提が揃っているか・GATE を通過しているか）
 *   4. エージェントを実行 → 1 に戻る。人への依頼か完了なら止まる
 *
 * 顧客情報が足りないときは、その場で質問して（対話モード）回答を資料に追記し、そのまま先へ進む。
 * 止まったときは runs/<id>/NEXT_ACTION.md に「次に人がやること」を書き出す。
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { AGENTS } from "./agents/index.js";
import { appendAnswers, askQuestions } from "./ask.js";
import { MANGA00_ROLE, Manga00Decision } from "./agents/manga00.js";
import type { AgentId, PipelineContext } from "./agents/types.js";
import { BLUEPRINT, GATES, blueprintEntry, type BlueprintId } from "./blueprint.js";
import { callAgent } from "./llm.js";
import { loadSharedSystem, runAgent } from "./runner.js";
import { hashSource, loadState, saveState, type RunState } from "./state.js";

const MAX_STEPS = 8;

export interface AgentStatus {
  id: BlueprintId;
  team: string;
  name: string;
  role: string;
  implemented: boolean;
  has_output: boolean;
  /** 成果物の作成後に資料が更新された */
  stale: boolean;
  last_run_at: string | null;
  missing_prerequisites: BlueprintId[];
  gate: string | null;
  gate_passed: boolean;
  runnable: boolean;
}

const isImplemented = (id: string): id is AgentId => id in AGENTS;

export function buildStatus(ctx: PipelineContext, state: RunState): AgentStatus[] {
  const currentHash = hashSource(ctx.source);
  const hasOutput = (id: string) => (ctx.outputs as Record<string, unknown>)[id] != null;
  return BLUEPRINT.map((b) => {
    const rec = state.agentRuns[b.id];
    const missing = b.requires.filter((r) => !hasOutput(r));
    const gatePassed = b.gate == null || state.approvals[b.gate] != null;
    const implemented = isImplemented(b.id);
    return {
      id: b.id,
      team: b.team,
      name: b.name,
      role: b.role,
      implemented,
      has_output: hasOutput(b.id),
      stale: rec != null && rec.sourceHash !== currentHash,
      last_run_at: rec?.at ?? null,
      missing_prerequisites: missing,
      gate: b.gate,
      gate_passed: gatePassed,
      runnable: implemented && missing.length === 0 && gatePassed,
    };
  });
}

function buildManga00Input(ctx: PipelineContext, state: RunState, status: AgentStatus[]): string {
  const approvals = Object.entries(GATES).map(([id, g]) => ({
    gate: id,
    name: g.name,
    description: g.description,
    approved: state.approvals[id as keyof typeof GATES] ?? null,
  }));
  return [
    "現在の run の状況です。次の一手を1つ決めてください。",
    `<agents_status>\n${JSON.stringify(status, null, 2)}\n</agents_status>`,
    `<gates>\n${JSON.stringify(approvals, null, 2)}\n</gates>`,
    `<outputs>\n${JSON.stringify(ctx.outputs, null, 2)}\n</outputs>`,
    `<recent_decisions>\n${JSON.stringify(state.decisions.slice(-5), null, 2)}\n</recent_decisions>`,
  ].join("\n\n");
}

/** --mock 用。設計図のルールどおりに判断する簡易版 */
function mockDecide(ctx: PipelineContext, status: AgentStatus[]): Manga00Decision {
  const input = status.find((s) => s.id === "INPUT00")!;
  if (!input.has_output || input.stale) {
    return {
      situation: input.stale ? "資料が更新されており、顧客情報が古い。" : "顧客情報がまだない。",
      action: "run_agent",
      agent_id: "INPUT00",
      instructions: input.stale ? "資料に追記された顧客の回答を反映してください。" : null,
      reason: "Step 0 として INPUT00 を最初に動かす。",
      human_request: null,
    };
  }
  const profile = ctx.outputs.INPUT00!;
  if (!profile.ready_for_story) {
    return {
      situation: "顧客情報に必須項目の不足がある。",
      action: "ask_human",
      agent_id: null,
      instructions: null,
      reason: "必須情報が揃うまで STORY には進まない。",
      human_request: {
        to: "client",
        title: "制作開始前のご確認事項",
        message: "漫画制作を始めるにあたり、以下の点をお教えください。",
        questions: [...profile.missing_items]
          .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "required" ? -1 : 1))
          .map((m) => m.question),
      },
    };
  }
  return {
    situation: "顧客情報は揃っている。",
    action: "ask_human",
    agent_id: null,
    instructions: null,
    reason: "次の STORY01 が未実装のため止まる。",
    human_request: {
      to: "staff",
      title: "STORY01（企画立案）が未実装です",
      message: "顧客情報シート（INPUT00.md）をもとに、企画立案を手作業で進めてください。",
      questions: [],
    },
  };
}

/** MANGA00 の判断がルールに合っているかをコードで確認する。問題があれば理由を返す */
function checkDecision(d: Manga00Decision, status: AgentStatus[], state: RunState): string | null {
  if (d.action === "run_agent") {
    if (!d.agent_id) return "実行するエージェントが指定されていません。";
    const s = status.find((x) => x.id === d.agent_id);
    if (!s || !blueprintEntry(d.agent_id)) return `${d.agent_id} は設計図にないエージェントです。`;
    if (!s.implemented) return `${d.agent_id}（${s.name}）はまだ実装されていません。`;
    if (s.missing_prerequisites.length) return `${d.agent_id} の前提となる成果物（${s.missing_prerequisites.join("、")}）がありません。`;
    if (!s.gate_passed) return `${d.agent_id} は ${s.gate} の承認前のため実行できません（GATE）。`;
    const last = state.decisions.at(-1);
    if (s.has_output && !s.stale && !d.instructions && last?.agent_id === d.agent_id) {
      return `${d.agent_id} を、資料も指示も変わらないまま続けて再実行しようとしました。`;
    }
  }
  if (d.action === "ask_human" && !d.human_request) return "人への依頼内容がありません。";
  return null;
}

const TO_LABEL = { client: "顧客", staff: "コルトスタッフ", approver: "稟議承認者" } as const;

async function writeNextAction(ctx: PipelineContext, runId: string, d: Manga00Decision): Promise<string> {
  const lines = [`# 次にやること（MANGA00）`, "", `**状況:** ${d.situation}`, "", `**判断理由:** ${d.reason}`, ""];
  if (d.action === "complete") {
    lines.push("## ✅ 全工程が完了しました");
  } else if (d.human_request) {
    const r = d.human_request;
    lines.push(`## 依頼先: ${TO_LABEL[r.to]}`, "", `### ${r.title}`, "", r.message, "");
    r.questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push(
      "",
      "---",
      "",
      "### 対応が終わったら",
      r.to === "client"
        ? "顧客の回答を `source.md` の末尾に追記し、次のコマンドで MANGA00 を再開してください。"
        : r.to === "approver"
          ? "承認が得られたら `npm run manga -- approve " + runId + " WF2 --by 承認者名` を実行し、MANGA00 を再開してください。"
          : "対応後、次のコマンドで MANGA00 を再開してください。",
      "",
      "```",
      `npm run manga -- continue ${runId}`,
      "```",
    );
  }
  const file = path.join(ctx.runDir, "NEXT_ACTION.md");
  await writeFile(file, lines.join("\n") + "\n");
  return file;
}

async function writeLog(ctx: PipelineContext, state: RunState): Promise<void> {
  const ACTION_LABEL: Record<string, string> = { run_agent: "エージェント実行", ask_human: "人に依頼", complete: "完了", rejected: "差し止め" };
  const lines = ["# MANGA00 判断ログ", ""];
  state.decisions.forEach((d, i) => {
    lines.push(
      `## ${i + 1}. ${ACTION_LABEL[d.action] ?? d.action}${d.agent_id ? `: ${d.agent_id}` : ""}（${d.at}）`,
      `- 状況: ${d.situation}`,
      `- 理由: ${d.reason}`,
      `- 結果: ${d.result}`,
      "",
    );
  });
  await writeFile(path.join(ctx.runDir, "MANGA00_log.md"), lines.join("\n"));
}

export interface Manga00Options {
  mock: boolean;
  /** 顧客情報が足りないとき、その場で質問する */
  interactive: boolean;
}

export async function runManga00(ctx: PipelineContext, runId: string, opts: Manga00Options): Promise<void> {
  console.log(`🧭 MANGA00 起動（run: ${runId}）${opts.mock ? "［モック］" : ""}`);
  const sharedSystem = opts.mock ? "" : await loadSharedSystem();
  /** この起動中にすでに聞いた質問（同じ質問を繰り返さない） */
  const asked = new Set<string>();

  for (let step = 1; step <= MAX_STEPS; step++) {
    const state = await loadState(ctx.runDir);
    const status = buildStatus(ctx, state);

    let decision: Manga00Decision;
    if (opts.mock) {
      decision = mockDecide(ctx, status);
    } else {
      const res = await callAgent({
        agentId: "MANGA00",
        sharedSystem,
        rolePrompt: MANGA00_ROLE,
        userContent: buildManga00Input(ctx, state, status),
        schema: Manga00Decision,
        effort: "medium",
      });
      decision = res.data;
    }
    console.log(`\n［判断 ${step}］${decision.situation}\n  → ${decision.reason}`);

    const at = new Date().toISOString();
    const problem = checkDecision(decision, status, state);
    if (problem) {
      // ルール違反の判断は実行せず、スタッフに確認を依頼して止まる
      state.decisions.push({ at, action: "rejected", agent_id: decision.agent_id, situation: decision.situation, reason: decision.reason, result: `差し止め: ${problem}` });
      await saveState(ctx.runDir, state);
      await writeLog(ctx, state);
      const stop: Manga00Decision = {
        ...decision,
        action: "ask_human",
        human_request: {
          to: "staff",
          title: "MANGA00 の判断を差し止めました",
          message: `MANGA00 が次の判断をしましたが、ルールに合わないため実行していません。\n\n- 判断: ${decision.action} ${decision.agent_id ?? ""}\n- 問題: ${problem}\n\n状況を確認し、必要なら資料や成果物を修正してから再開してください。`,
          questions: [],
        },
      };
      const file = await writeNextAction(ctx, runId, stop);
      console.log(`\n⛔ 差し止め: ${problem}\n   次にやること: ${path.relative(process.cwd(), file)}`);
      return;
    }

    if (decision.action === "run_agent") {
      const id = decision.agent_id as AgentId;
      try {
        await runAgent(ctx, id, { mock: opts.mock, instructions: decision.instructions });
        state.decisions.push({ at, action: decision.action, agent_id: id, situation: decision.situation, reason: decision.reason, result: "実行完了" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        state.decisions.push({ at, action: decision.action, agent_id: id, situation: decision.situation, reason: decision.reason, result: `失敗: ${msg}` });
        await saveState(ctx.runDir, { ...(await loadState(ctx.runDir)), decisions: state.decisions });
        await writeLog(ctx, state);
        throw e;
      }
      // runAgent が agentRuns を更新しているので、最新の state に判断履歴を足して保存する
      await saveState(ctx.runDir, { ...(await loadState(ctx.runDir)), decisions: state.decisions });
      await writeLog(ctx, state);
      continue;
    }

    // 顧客情報の不足 → 対話モードならその場で質問する
    const req = decision.human_request;
    if (opts.interactive && decision.action === "ask_human" && req?.to === "client") {
      const fresh = req.questions.filter((q) => !asked.has(q));
      if (fresh.length) {
        fresh.forEach((q) => asked.add(q));
        const qas = await askQuestions(req.title, fresh);
        const answered = qas.filter((x) => x.answer).length;
        if (answered > 0) {
          ctx.source = await appendAnswers(ctx.runDir, qas, ctx.source);
          state.decisions.push({
            at, action: decision.action, agent_id: null, situation: decision.situation, reason: decision.reason,
            result: `その場で質問: ${answered}件回答、${qas.length - answered}件は未回答（source.md に追記）`,
          });
          await saveState(ctx.runDir, state);
          await writeLog(ctx, state);
          console.log(`\n✔ ${answered}件の回答を資料に追記しました。顧客情報を更新して続けます。`);
          continue;
        }
        console.log("\n回答がなかったため、顧客への確認事項として書き出します。");
      }
    }

    // 人への依頼 or 完了 → ここで止まる
    state.decisions.push({
      at,
      action: decision.action,
      agent_id: null,
      situation: decision.situation,
      reason: decision.reason,
      result: decision.action === "complete" ? "完了" : `${TO_LABEL[decision.human_request!.to]}に依頼: ${decision.human_request!.title}`,
    });
    await saveState(ctx.runDir, state);
    await writeLog(ctx, state);
    const file = await writeNextAction(ctx, runId, decision);
    console.log(
      decision.action === "complete"
        ? `\n✅ 全工程完了`
        : `\n⏸ ${TO_LABEL[decision.human_request!.to]}への依頼で一時停止: ${decision.human_request!.title}`,
    );
    console.log(`   次にやること: ${path.relative(process.cwd(), file)}`);
    return;
  }
  console.log(`\n⚠ ${MAX_STEPS} 回判断しても止まらなかったため中断しました。MANGA00_log.md を確認してください。`);
}
