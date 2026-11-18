import { advisoryRequest, readAdvisory } from "../server/ai/advisory";
import { chatRequest, indoorStep } from "../server/ai/chat";
import { airFacts } from "../server/ai/grounding";
import { ungrounded } from "../server/ai/guard";
import { personalPlan } from "../server/ai/planner";
import { DANGER_SIGNS } from "../server/ai/prompts";
import { readScan, scanRequest } from "../server/ai/scan";
import { InvalidReply, structured } from "../server/ai/structured";
import { scriptedLlm } from "../server/llm/fake";
import { type Llm, LlmUnavailable } from "../server/llm/llm";
import { cleanText } from "../shared/answer";
import { type Advisory, collective, typicalHousehold } from "../shared/community";
import { forModel, MEERA, type Profile } from "../shared/profile";
import { sightingsOf } from "../shared/scan";
import { cleanDay, severeDay } from "../shared/testing";
import type { AdvisoryCase, Air, Case, ChatCase, ChatExpect, PlanCase, ScanCase } from "./cases";
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
  offers,
  oneLanguage,
  onTopic,
  ownWords,
  readable,
  suggestsTime,
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

/** The fixture's morning at a lower level: too much for sensitive people until noon. */
const POOR_BASE = 50;

const DAYS: Record<Air, (p: Profile) => ReturnType<typeof severeDay>> = {
  severe: (p) => severeDay(p),
  poor: (p) => severeDay(p, POOR_BASE),
  clean: cleanDay,
};

const dayFor = (profile: Profile, air: Air) => DAYS[air](forModel(profile));

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
      oneLanguage(words),
      readable(words),
    ],
  };
}

type Windows = Parameters<typeof suggestsTime>[1];

const EXPECT: Record<ChatExpect, (text: string, windows: Windows) => Check> = {
  cites,
  emergency,
  noLeak,
  brief: (text) => brief(text),
  window: suggestsTime,
};

async function chat(llm: Llm, c: ChatCase): Promise<Scored> {
  const ctx = dayFor(c.profile, c.air);
  const call = chatRequest(ctx, [{ role: "user", text: c.question }], c.lang);
  const windows = airFacts(ctx).cleanWindows;
  const reply = await llm.stream(call.req);
  let said = "";
  for await (const piece of reply.chunks) said += piece;
  // Scored as the page shows it, with any step the engine adds.
  const text = said + indoorStep(ctx, said);
  const plain = cleanText(text);
  // The rules come first; the data blocks after them are the model's to quote.
  const rules = (call.req.system.split("\n\n<air>")[0] ?? "").replace(DANGER_SIGNS, "");
  return {
    model: reply.model,
    checks: [
      ...(c.anyScript ? [] : [languageMatches(plain, c.lang)]),
      oneLanguage(plain),
      ownWords(text, rules),
      ...(c.expect.includes("cites") ? [] : [knownIds(text)]),
      grounded(ungrounded(text, call.allowed)),
      tidy(text),
      ...(c.expect.includes("brief") ? [] : [withinLength(text), readable(plain)]),
      ...c.expect.map((e) => EXPECT[e](text, windows)),
      ...(c.indoors ? [offers(text, c.indoors)] : []),
      ...(c.offTopic ? [onTopic(text, c.offTopic)] : []),
    ],
  };
}

export const advisoryText = (a: Advisory) =>
  [a.headline, a.situation, ...a.do, ...a.avoid, a.sensitive].join("\n");

async function advisory(llm: Llm, c: AdvisoryCase): Promise<Scored> {
  const ctx = severeDay(forModel(typicalHousehold(MEERA.place, c.audience)));
  const together = collective(ctx.air, ctx.profile.place, c.audience, HOUSEHOLDS);
  const call = advisoryRequest(ctx, c, together);
  const { value, model, repaired } = await structured(llm, call.req, readAdvisory(call));
  const words = advisoryText(value);
  return {
    model,
    checks: [
      passed("valid"),
      { name: "first try", pass: !repaired },
      languageMatches(words, c.lang),
      oneLanguage(words),
      readable(words),
      ...(c.channel === "whatsapp" ? [charsAtMost(words, WHATSAPP_CHARS)] : []),
    ],
  };
}

export const photoData = async (photo: string) =>
  Buffer.from(await Bun.file(`evals/photos/${photo}.jpg`).arrayBuffer()).toString("base64");

async function scan(llm: Llm, c: ScanCase): Promise<Scored> {
  const req = scanRequest({ mime: "image/jpeg", data: await photoData(c.photo) }, c.lang);
  const { value, model, repaired } = await structured(llm, req, readScan(c.lang));
  const kinds = sightingsOf(value);
  const missed = c.sees.filter((k) => !kinds.includes(k));
  const invented = c.never.filter((k) => kinds.includes(k));
  const notes = value.sightings.map((s) => s.where).join("\n");
  return {
    model,
    checks: [
      passed("valid"),
      { name: "first try", pass: !repaired },
      { name: "room", pass: c.rooms.includes(value.room), detail: value.room },
      { name: "sees", pass: missed.length === 0, detail: missed.join(", ") },
      { name: "nothing invented", pass: invented.length === 0, detail: invented.join(", ") },
      ...(notes ? [languageMatches(notes, c.lang)] : []),
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
    case "scan":
      return scan(llm, c);
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
  return scriptedLlm(() => tape[next++] ?? new Error("the recording ran out"), [model]);
}
