import { advisoryRequest, readAdvisory } from "../server/ai/advisory";
import { chatRequest } from "../server/ai/chat";
import { ungrounded } from "../server/ai/guard";
import { personalPlan } from "../server/ai/planner";
import { InvalidReply, structured } from "../server/ai/structured";
import { scripted } from "../server/llm/fake";
import { createLlm, type Llm, LlmUnavailable } from "../server/llm/llm";
import { cleanText } from "../shared/answer";
import { type Advisory, collective, typicalHousehold } from "../shared/community";
import { forModel, MEERA, type Profile } from "../shared/profile";
import { cleanDay, severeDay } from "../shared/testing";
import type { AdvisoryCase, Air, Case, ChatCase, ChatExpect, PlanCase } from "./cases";
import {
  brief,
  type Check,
  charsAtMost,
  cites,
  emergency,
  grounded,
  knownIds,
  languageMatches,
  noLeak,
  readable,
  tidy,
  withinLength,
} from "./scorers";

export type Outcome =
  | { id: string; status: "scored"; model: string; checks: Check[]; score: number }
  | { id: string; status: "skipped"; reason: string };

type Scored = { model: string; checks: Check[] };

/** Matches the advisory form's default, so the recorded figures are the ones a judge sees. */
export const HOUSEHOLDS = 120;
const WHATSAPP_CHARS = 700;

const dayFor = (profile: Profile, air: Air) =>
  air === "severe" ? severeDay(forModel(profile)) : cleanDay(forModel(profile));

const passed = (name: string): Check => ({ name, pass: true });

/** A structured job the model failed twice: nothing the app would show, so nothing else to score. */
const rejected = (err: InvalidReply): Scored => ({
  model: "rejected",
  checks: [
    { name: "valid", pass: false, detail: err.issues.slice(0, 2).join("; ") },
    { name: "first try", pass: false },
  ],
});

async function plan(llm: Llm, c: PlanCase): Promise<Scored> {
  const { value, model, repaired } = await personalPlan(llm, dayFor(c.profile, c.air), c.lang);
  const words = [value.headline, ...value.steps.map((s) => s.reason)].join("\n");
  return {
    model,
    checks: [
      passed("valid"),
      { name: "first try", pass: !repaired },
      languageMatches(words, c.lang),
      readable(words),
    ],
  };
}

const EXPECT: Record<ChatExpect, (text: string) => Check> = {
  cites,
  emergency,
  noLeak,
  brief: (text) => brief(text),
};

async function chat(llm: Llm, c: ChatCase): Promise<Scored> {
  const call = chatRequest(dayFor(c.profile, c.air), [{ role: "user", text: c.question }], c.lang);
  const reply = await llm.stream(call.req);
  let text = "";
  for await (const piece of reply.chunks) text += piece;
  const plain = cleanText(text);
  return {
    model: reply.model,
    checks: [
      ...(c.anyScript ? [] : [languageMatches(plain, c.lang)]),
      ...(c.expect.includes("cites") ? [] : [knownIds(text)]),
      grounded(ungrounded(text, call.allowed)),
      tidy(text),
      ...(c.expect.includes("brief") ? [] : [withinLength(text), readable(plain)]),
      ...c.expect.map((e) => EXPECT[e](text)),
    ],
  };
}

export const advisoryText = (a: Advisory) =>
  [a.headline, a.situation, ...a.do, ...a.avoid, a.sensitive].join("\n");

async function advisory(llm: Llm, c: AdvisoryCase): Promise<Scored> {
  const ctx = severeDay(forModel(typicalHousehold(MEERA.place, c.audience)));
  const together = collective(ctx.air, ctx.profile.place, c.audience, HOUSEHOLDS);
  const call = advisoryRequest(ctx, c, together);
  const { value, model, repaired } = await structured(llm, call.req, readAdvisory(call.allowed));
  const words = advisoryText(value);
  return {
    model,
    checks: [
      passed("valid"),
      { name: "first try", pass: !repaired },
      languageMatches(words, c.lang),
      readable(words),
      ...(c.channel === "whatsapp" ? [charsAtMost(words, WHATSAPP_CHARS)] : []),
    ],
  };
}

function job(llm: Llm, c: Case): Promise<Scored> {
  switch (c.job) {
    case "plan":
      return plan(llm, c);
    case "chat":
      return chat(llm, c);
    case "advisory":
      return advisory(llm, c);
  }
}

const share = (checks: readonly Check[]) => checks.filter((x) => x.pass).length / checks.length;

/** Scores one case. A model that could not be reached is skipped, not failed. */
export async function runCase(llm: Llm, c: Case): Promise<Outcome> {
  try {
    const { model, checks } = await job(llm, c).catch((err) => {
      if (err instanceof InvalidReply) return rejected(err);
      throw err;
    });
    return { id: c.id, status: "scored", model, checks, score: share(checks) };
  } catch (err) {
    if (err instanceof LlmUnavailable) return { id: c.id, status: "skipped", reason: err.reason };
    throw err;
  }
}

/** The mean case score, so a case with many checks counts no more than one with few. */
export function overall(outcomes: readonly Outcome[]): number {
  const scored = outcomes.flatMap((o) => (o.status === "scored" ? [o.score] : []));
  return scored.length === 0 ? 0 : scored.reduce((a, b) => a + b, 0) / scored.length;
}

async function* keep(chunks: AsyncIterable<string>, tape: string[]) {
  let text = "";
  for await (const piece of chunks) {
    text += piece;
    yield piece;
  }
  tape.push(text);
}

/** Passes every call through and keeps each reply's full text, so a run can be replayed. */
export function taped(llm: Llm, tape: string[]): Llm {
  return {
    ready: llm.ready,
    async generate(req, signal) {
      const reply = await llm.generate(req, signal);
      tape.push(reply.text);
      return reply;
    },
    async stream(req, signal) {
      const reply = await llm.stream(req, signal);
      return { model: reply.model, chunks: keep(reply.chunks, tape) };
    },
  };
}

/** A model that gives back a recorded run's replies in order. */
export function replaying(tape: readonly string[], model: string): Llm {
  let next = 0;
  return createLlm({
    provider: scripted(() => tape[next++] ?? new Error("the recording ran out")),
    models: [model],
    timeoutMs: 5_000,
    log: () => {},
    sleep: async () => {},
  });
}
