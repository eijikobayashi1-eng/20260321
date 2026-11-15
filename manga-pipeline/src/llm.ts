/**
 * Claude API 呼び出しの共通処理。
 * 全エージェントはここを通して「システムプロンプト + 入力JSON → 構造化出力」を得る。
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// 体系図の指定（仮設定）: Claude（Sonnet）。環境変数 MANGA_MODEL で変更可
export const MODEL = process.env.MANGA_MODEL ?? "claude-sonnet-5-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface LlmRequest<T extends z.ZodType> {
  agentId: string;
  /** 全エージェント共通（コルトスタイルガイド等）。キャッシュ対象 */
  sharedSystem: string;
  /** エージェント固有の役割プロンプト */
  rolePrompt: string;
  /** エージェントへの入力（作業指示＋前工程の成果物） */
  userContent: string;
  schema: T;
  effort: Effort;
}

export interface LlmResult<T> {
  data: T;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  servedBy: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class AgentError extends Error {}

export async function callAgent<T extends z.ZodType>(req: LlmRequest<T>): Promise<LlmResult<z.infer<T>>> {
  // ストリーミング: ネーム全体など長い出力でもHTTPタイムアウトしないように
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    // 安全分類器による拒否時はサーバー側で別モデルに自動フォールバック
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: req.effort, format: zodOutputFormat(req.schema) },
    system: [
      // 共通部分を先頭に置き、全エージェントでプロンプトキャッシュを共有
      { type: "text", text: req.sharedSystem, cache_control: { type: "ephemeral" } },
      { type: "text", text: req.rolePrompt },
    ],
    messages: [{ role: "user", content: req.userContent }],
  });

  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") {
    throw new AgentError(
      `[${req.agentId}] モデルが応答を拒否しました (${msg.stop_details?.category ?? "unknown"}): ${msg.stop_details?.explanation ?? ""}`,
    );
  }
  if (msg.stop_reason === "max_tokens") {
    throw new AgentError(`[${req.agentId}] 出力が max_tokens に達しました。ページ数を減らして再実行してください。`);
  }

  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AgentError(`[${req.agentId}] JSONを解析できませんでした: ${text.slice(0, 200)}`);
  }
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) {
    throw new AgentError(`[${req.agentId}] 出力がスキーマに合いません: ${parsed.error.message}`);
  }

  return {
    data: parsed.data,
    usage: {
      input: msg.usage.input_tokens,
      output: msg.usage.output_tokens,
      cacheRead: msg.usage.cache_read_input_tokens ?? 0,
      cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
    },
    servedBy: msg.model,
  };
}
