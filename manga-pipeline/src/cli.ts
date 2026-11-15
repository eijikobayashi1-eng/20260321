/**
 * コマンド一覧（npm run manga -- <コマンド>）
 *
 *   start <資料.md>                 新しい案件を始める。MANGA00 が INPUT00 から順に判断して進める
 *   continue <runId>                人の対応（顧客回答の追記・承認など）が終わったら MANGA00 を再開
 *   approve <runId> WF2 --by 名前   GATE の承認を記録する（例: 稟議承認）
 *   status <runId>                  案件の進み具合を表示
 *   run <エージェント> <資料.md>     エージェントを1つだけ単体で実行（新しい案件として）
 *   rerun <エージェント> <runId>     既存の案件でエージェントを1つだけ再実行
 *   list                            実装済みエージェントの一覧
 *
 *   --mock    Claude API を呼ばずにダミーの出力で動作確認する
 *   --no-ask  顧客情報が足りなくてもその場で質問せず、NEXT_ACTION.md に書き出して止まる
 */
import path from "node:path";
import { AGENTS } from "./agents/index.js";
import type { AgentId } from "./agents/types.js";
import { GATES, type GateId } from "./blueprint.js";
import { buildStatus, runManga00 } from "./orchestrator.js";
import { createRun, loadContext, runAgent } from "./runner.js";
import { loadState, saveState } from "./state.js";

function usage(): never {
  console.log(`使い方: npm run manga -- <コマンド>

  start <資料.md>                 新しい案件を始める（MANGA00 が進行を管理）
  continue <runId>                人の対応が終わったら MANGA00 を再開
  approve <runId> WF2 --by 名前   GATE の承認を記録（--note でメモも残せる）
  status <runId>                  案件の進み具合を表示
  run <エージェント> <資料.md>     エージェントを1つだけ実行（新しい案件として）
  rerun <エージェント> <runId>     既存の案件でエージェントを1つだけ再実行
  list                            実装済みエージェントの一覧

  --mock    Claude API を呼ばずにダミーの出力で動作確認する
  --no-ask  顧客情報が足りなくてもその場で質問せず、NEXT_ACTION.md に書き出して止まる

  ※ start / continue では、顧客情報が足りないと MANGA00 がその場で質問します。`);
  process.exit(1);
}

function asAgentId(s: string | undefined): AgentId {
  if (!s || !(s in AGENTS)) {
    console.error(`不明なエージェントです: ${s ?? "（指定なし）"}。実装済み: ${Object.keys(AGENTS).join("、")}`);
    process.exit(1);
  }
  return s as AgentId;
}

function option(args: string[], name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
}

async function main() {
  const args = process.argv.slice(2);
  const mock = args.includes("--mock");
  // 顧客情報が足りないときにその場で質問するか（端末から実行したときは既定で質問する）
  const interactive = args.includes("--ask") || (!args.includes("--no-ask") && process.stdin.isTTY === true);
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--by" || args[i] === "--note") i++;
    else if (!args[i].startsWith("--")) positional.push(args[i]);
  }
  const [cmd, a1, a2] = positional;

  switch (cmd) {
    case "list":
      for (const a of Object.values(AGENTS)) console.log(`${a.id}  ［${a.team}］ ${a.name}`);
      return;

    case "start": {
      if (!a1) usage();
      const ctx = await createRun(a1);
      await runManga00(ctx, path.basename(ctx.runDir), { mock, interactive });
      return;
    }

    case "continue": {
      if (!a1) usage();
      await runManga00(await loadContext(a1), a1, { mock, interactive });
      return;
    }

    case "approve": {
      if (!a1 || !a2) usage();
      if (!(a2 in GATES)) {
        console.error(`不明な GATE です: ${a2}。指定できるのは ${Object.keys(GATES).join("、")} です。`);
        process.exit(1);
      }
      const by = option(args, "--by");
      if (!by) {
        console.error("承認者を --by で指定してください（例: --by 佐藤課長）。");
        process.exit(1);
      }
      const ctx = await loadContext(a1);
      const state = await loadState(ctx.runDir);
      state.approvals[a2 as GateId] = { at: new Date().toISOString(), by, note: option(args, "--note") ?? "" };
      await saveState(ctx.runDir, state);
      console.log(`✔ ${GATES[a2 as GateId].name} の承認を記録しました（承認者: ${by}）。MANGA00 を再開するには: npm run manga -- continue ${a1}`);
      return;
    }

    case "status": {
      if (!a1) usage();
      const ctx = await loadContext(a1);
      const state = await loadState(ctx.runDir);
      console.log(`案件: ${a1}\n`);
      for (const s of buildStatus(ctx, state)) {
        const mark = s.has_output ? (s.stale ? "△ 資料更新あり（要再実行）" : "✅ 完了") : s.runnable ? "▶ 実行可能" : !s.implemented ? "－ 未実装" : !s.gate_passed ? `🔒 ${s.gate} 承認待ち` : "… 前工程待ち";
        console.log(`${s.id.padEnd(9)} ${s.name.padEnd(14, "　")} ${mark}`);
      }
      const approved = Object.entries(state.approvals);
      console.log(`\n承認: ${approved.length ? approved.map(([g, a]) => `${g}（${a!.by}）`).join("、") : "なし"}`);
      return;
    }

    case "run": {
      const id = asAgentId(a1);
      if (!a2) usage();
      await runAgent(await createRun(a2), id, { mock });
      return;
    }

    case "rerun": {
      const id = asAgentId(a1);
      if (!a2) usage();
      await runAgent(await loadContext(a2), id, { mock });
      return;
    }

    default:
      usage();
  }
}

main().catch((e) => {
  console.error(`✖ エラー: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
