import type { Candidate } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import { checkPlan } from "@shared/checker";
import { DayPlanSchema, MAX_STEPS, type PlanReply, type PlanStep } from "@shared/plan";
import type { Language } from "@shared/profile";
import type { Llm } from "../llm/llm";
import type { LlmRequest } from "../llm/types";
import { airFacts, householdFacts, numbersIn, optionFacts, optionsFor } from "./grounding";
import { block, plannerSystem } from "./prompts";
import { type Parsed, parseShaped, proseIssues, structured, verdict } from "./structured";

/** The reply's shape, with ids limited to today's options and this household. */
function planSchema(actionIds: readonly string[], memberIds: readonly string[]) {
  return {
    type: "object",
    properties: {
      headline: { type: "string", description: "One sentence, under 150 characters." },
      steps: {
        type: "array",
        minItems: 3,
        maxItems: MAX_STEPS,
        items: {
          type: "object",
          properties: {
            actionId: { type: "string", enum: actionIds },
            time: { type: "string", description: "Local 24-hour time, HH:MM." },
            who: { type: "array", items: { type: "string", enum: memberIds } },
            reason: { type: "string", description: "One or two sentences, under 280 characters." },
          },
          required: ["actionId", "time", "who", "reason"],
        },
      },
    },
    required: ["headline", "steps"],
  };
}

/** A plan request, the options the model may choose from, and the figures it may quote. */
export type PlannerCall = {
  req: LlmRequest;
  options: Candidate[];
  allowed: number[];
  lang: Language;
};

/** Builds the plan request from the server's own reading of the day. */
export function plannerRequest(ctx: Context, lang: Language): PlannerCall {
  const options = optionsFor(ctx);
  const packet = {
    air: airFacts(ctx),
    household: householdFacts(ctx.profile),
    options: optionFacts(ctx, options),
  };
  const text = [
    block("air", packet.air),
    block("household", packet.household),
    block("options", packet.options),
    "Plan today for this household.",
  ].join("\n\n");
  return {
    req: {
      job: "plan",
      system: plannerSystem(lang),
      turns: [{ role: "user", text }],
      schema: planSchema(
        options.map((c) => c.action.id),
        ctx.profile.members.map((m) => m.id),
      ),
      // Hindi in Devanagari takes several times the tokens of English.
      maxTokens: 2000,
      temperature: 0.4,
    },
    options,
    allowed: numbersIn(packet),
    lang,
  };
}

/** Keeps each step's people to those its action covers, and the day in order. */
function normalize(steps: readonly PlanStep[], options: readonly Candidate[]): PlanStep[] {
  const covers = new Map(options.map((c) => [c.action.id, c.who]));
  return steps
    .map((s) => {
      const allowed = covers.get(s.actionId) ?? [];
      const who = s.who.filter((id) => allowed.includes(id));
      return { ...s, who: who.length > 0 ? who : allowed };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Reads a reply as a plan and returns every way it breaks the rules: its
 * shape, the safety and coverage checks in shared/plan, any figure that was
 * not in the data, and words in the wrong language.
 */
export function readPlan(ctx: Context, { options, allowed, lang }: Omit<PlannerCall, "req">) {
  return (text: string): Parsed<PlanReply["plan"]> => {
    const shaped = parseShaped(text, DayPlanSchema, "plan");
    if (!shaped.ok) return shaped;
    const plan = { ...shaped.value, steps: normalize(shaped.value.steps, options) };
    const words = [plan.headline, ...plan.steps.map((s) => s.reason)].join("\n");
    const issues = [
      ...checkPlan(ctx, plan, options).map((i) => i.detail),
      ...proseIssues(words, allowed, lang),
    ];
    return verdict<PlanReply["plan"]>({ ...plan, source: "ai" }, issues);
  };
}

/** A plan written by the model for this household and checked like the rule plan is. */
export async function personalPlan(llm: Llm, ctx: Context, lang: Language, signal?: AbortSignal) {
  const call = plannerRequest(ctx, lang);
  return structured(llm, call.req, readPlan(ctx, call), signal);
}
