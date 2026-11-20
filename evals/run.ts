import { mkdir } from "node:fs/promises";
import { z } from "zod";
import { PROMPT_VERSION } from "../server/ai/prompts";
import { loadEnv } from "../server/env";
import { llmFromEnv } from "../server/llm/config";
import type { LogLine } from "../server/llm/types";
import { CASES } from "./cases";
import { type Outcome, overall, replaying, runCase, taped } from "./jobs";

/*
 * `just eval` asks the configured model every case in cases.ts, prints a
 * score and saves the raw replies. `--replay` scores the saved replies again
 * without a key, and fails if the score has fallen since they were recorded.
 */

const RECORDING = "evals/recordings/latest.json";
const RESULTS = "evals/results/latest.json";

const RecordingSchema = z.object({
  promptVersion: z.string(),
  at: z.string(),
  score: z.number(),
  cases: z.record(z.string(), z.object({ model: z.string(), replies: z.array(z.string()) })),
});
type Recording = z.infer<typeof RecordingSchema>;

type Usage = { calls: number; failed: number; input: number; output: number; ms: number };

const percent = (x: number) => `${(x * 100).toFixed(1)}%`;

/** One case's line: its score and the checks it failed, or why it was skipped. */
function caseLine(o: Outcome, width: number): string {
  if (o.status === "skipped") return `${o.id.padEnd(width)}skipped  ${o.reason}`;
  const why = o.checks
    .filter((c) => !c.pass)
    .map((c) => (c.detail ? `${c.name}: ${c.detail}` : c.name))
    .join("; ");
  return `${o.id.padEnd(width)}${percent(o.score).padStart(6)}   ${why}`;
}

/** How many of the cases that ran each check passed it. */
function byCheck(outcomes: readonly Outcome[]): Map<string, { pass: number; of: number }> {
  const tally = new Map<string, { pass: number; of: number }>();
  for (const o of outcomes) {
    if (o.status === "skipped") continue;
    for (const c of o.checks) {
      const t = tally.get(c.name) ?? { pass: 0, of: 0 };
      tally.set(c.name, { pass: t.pass + (c.pass ? 1 : 0), of: t.of + 1 });
    }
  }
  return tally;
}

function report(outcomes: readonly Outcome[]) {
  const width = Math.max(...outcomes.map((o) => o.id.length)) + 2;
  for (const o of outcomes) console.info(caseLine(o, width));
  const tally = byCheck(outcomes);
  console.info("\nBy check");
  const label = Math.max(...[...tally.keys()].map((n) => n.length)) + 2;
  for (const [name, t] of tally) console.info(`  ${name.padEnd(label)}${t.pass}/${t.of}`);
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  const score = overall(outcomes);
  console.info(
    `\nScore ${percent(score)} over ${outcomes.length - skipped} cases${skipped ? `, ${skipped} skipped` : ""}`,
  );
  return score;
}

async function live() {
  const env = loadEnv();
  if (env.LLM_PROVIDER === "fake") {
    console.error("No model is configured. Set GEMINI_API_KEY in .env, or LLM_PROVIDER=ollama.");
    process.exit(1);
  }
  const usage: Usage = { calls: 0, failed: 0, input: 0, output: 0, ms: 0 };
  const log = (line: LogLine) => {
    usage.calls += 1;
    if (line.outcome !== "ok") usage.failed += 1;
    usage.input += Number(line.in);
    usage.output += Number(line.out);
    usage.ms += Number(line.ms);
  };
  const llm = llmFromEnv(env, log);
  // The free tier allows a handful of requests a minute.
  const delayMs = Number(process.env.EVAL_DELAY_MS ?? 4000);

  const outcomes: Outcome[] = [];
  const cases: Recording["cases"] = {};
  for (const [i, c] of CASES.entries()) {
    if (i > 0) await Bun.sleep(delayMs);
    const tape: string[] = [];
    const outcome = await runCase(taped(llm, tape), c);
    console.error(`${i + 1}/${CASES.length} ${c.id}`);
    outcomes.push(outcome);
    if (outcome.status === "scored") cases[c.id] = { model: outcome.model, replies: tape };
  }

  const score = report(outcomes);
  const mean = usage.calls ? usage.ms / usage.calls / 1000 : 0;
  console.info(
    `Model calls ${usage.calls} (${usage.failed} failed), tokens ${usage.input} in and ${usage.output} out, ${mean.toFixed(1)} s each`,
  );
  if (Object.keys(cases).length === 0) {
    console.error("No case reached the model, so the last recording is kept.");
    process.exit(1);
  }
  const recording: Recording = {
    promptVersion: PROMPT_VERSION,
    at: new Date().toISOString(),
    score,
    cases,
  };
  await mkdir("evals/results", { recursive: true });
  await Bun.write(RECORDING, `${JSON.stringify(recording, null, 2)}\n`);
  await Bun.write(RESULTS, `${JSON.stringify({ score, usage, outcomes }, null, 2)}\n`);
}

async function replay() {
  const file = Bun.file(RECORDING);
  if (!(await file.exists())) {
    console.info("No recorded replies yet; run `just eval` with GEMINI_API_KEY set to make them.");
    return;
  }
  const recording = RecordingSchema.parse(await file.json());
  const outcomes: Outcome[] = [];
  for (const c of CASES) {
    const saved = recording.cases[c.id];
    outcomes.push(
      saved
        ? await runCase(replaying(saved.replies, saved.model), c)
        : { id: c.id, status: "skipped", reason: "not recorded" },
    );
  }
  const score = report(outcomes);
  if (recording.promptVersion !== PROMPT_VERSION) {
    console.info(
      `Recorded with prompts ${recording.promptVersion}; they are now ${PROMPT_VERSION}. Run \`just eval\` again.`,
    );
    return;
  }
  if (score < recording.score - 1e-9) {
    console.error(`The score fell from ${percent(recording.score)} when recorded.`);
    process.exit(1);
  }
}

if (import.meta.main) await (process.argv.includes("--replay") ? replay() : live());
