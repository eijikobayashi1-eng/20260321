/**
 * その場での質問（追加ヒアリング）。
 * MANGA00 が「顧客情報が足りない」と判断したとき、ターミナルで1問ずつ質問し、
 * 回答を source.md の末尾に「追加ヒアリング」として追記する。
 */
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

export interface QA {
  question: string;
  answer: string | null;
}

export async function askQuestions(title: string, questions: string[]): Promise<QA[]> {
  const rl = createInterface({ input: process.stdin, terminal: process.stdin.isTTY === true });
  // 1行ずつ順番に受け取る（入力が先に届いても取りこぼさない）
  const lines = rl[Symbol.asyncIterator]();
  console.log(`\n❓ ${title}`);
  console.log("   わかる範囲で答えてください。わからない質問は何も入力せず Enter で飛ばせます（顧客への確認事項に残ります）。\n");
  const results: QA[] = [];
  try {
    for (const [i, q] of questions.entries()) {
      console.log(`Q${i + 1}/${questions.length}. ${q}`);
      process.stdout.write("  回答 > ");
      const next = await lines.next();
      if (!process.stdin.isTTY) process.stdout.write(`${next.done ? "" : next.value}\n`);
      const a = next.done ? "" : String(next.value).trim();
      results.push({ question: q, answer: a || null });
    }
  } finally {
    rl.close();
  }
  return results;
}

/** 回答を source.md に追記し、追記後の資料全文を返す */
export async function appendAnswers(runDir: string, qas: QA[], currentSource: string): Promise<string> {
  const answered = qas.filter((x) => x.answer);
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
  const block = [
    "",
    `## 追加ヒアリング（${stamp}、MANGA00 の質問への回答）`,
    ...answered.flatMap((x) => [`- Q: ${x.question}`, `  - A: ${x.answer}`]),
    "",
  ].join("\n");
  await appendFile(path.join(runDir, "source.md"), block);
  return currentSource + block;
}
