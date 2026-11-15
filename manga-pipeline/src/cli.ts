/**
 * 使い方:
 *   npm run manga -- run INPUT00 <資料.md> [--mock]      新しい run を作ってエージェントを実行
 *   npm run manga -- rerun INPUT00 <runId> [--mock]     既存 run でエージェントを再実行（資料を追記した後など）
 *   npm run manga -- list                               エージェント一覧
 */
import { AGENTS } from "./agents/index.js";
import type { AgentId } from "./agents/types.js";
import { createRun, loadContext, runAgent } from "./runner.js";

function usage(): never {
  console.log(`使い方:
  npm run manga -- run <AGENT> <資料.md> [--mock]
  npm run manga -- rerun <AGENT> <runId> [--mock]
  npm run manga -- list

  --mock  Claude API を呼ばずにダミー出力で動作確認する`);
  process.exit(1);
}

function asAgentId(s: string | undefined): AgentId {
  if (!s || !(s in AGENTS)) {
    console.error(`不明なエージェント: ${s ?? "(なし)"}。実装済み: ${Object.keys(AGENTS).join(", ")}`);
    process.exit(1);
  }
  return s as AgentId;
}

async function main() {
  const args = process.argv.slice(2);
  const mock = args.includes("--mock");
  const [cmd, a1, a2] = args.filter((a) => !a.startsWith("--"));

  switch (cmd) {
    case "list":
      for (const a of Object.values(AGENTS)) console.log(`${a.id}  [${a.team}]  ${a.name}  requires: ${a.requires.join(", ") || "-"}`);
      return;
    case "run": {
      const id = asAgentId(a1);
      if (!a2) usage();
      const ctx = await createRun(a2);
      await runAgent(ctx, id, { mock });
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
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
