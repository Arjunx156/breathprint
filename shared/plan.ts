import { z } from "zod/mini";
import { actionById, type Candidate, prevents, protects } from "./actions/catalogue";
import type { ActionDef, Context, Timing } from "./actions/types";
import { healthLevel, LEVEL } from "./aqi";
import { clock } from "./format";
import { isSensitive } from "./profile";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const text = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));

/** One step of a plan: an action, a time, who it is for and why. */
export const PlanStepSchema = z.object({
  actionId: z.string().check(z.minLength(1), z.maxLength(40)),
  time: z.string().check(z.regex(HHMM)),
  who: z.array(z.string().check(z.maxLength(24))).check(z.maxLength(12)),
  reason: text(300),
});

/** A plan as the model writes it, before the server checks it. */
export const DayPlanSchema = z.object({
  headline: text(160),
  steps: z.array(PlanStepSchema).check(z.minLength(1), z.maxLength(8)),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type DayPlanBody = z.infer<typeof DayPlanSchema>;
/** A plan, and whether the rules or the model chose it. */
export type DayPlan = DayPlanBody & { source: "rules" | "ai" };

/** What /api/plan answers: a plan the model chose, already checked by the server. */
export const PlanReplySchema = z.object({
  plan: z.extend(DayPlanSchema, { source: z.literal("ai") }),
  model: z.string(),
  recorded: z.boolean(),
});

export type PlanReply = z.infer<typeof PlanReplySchema>;

/** More steps than this and a family stops reading. */
export const MAX_STEPS = 8;
const MAX_PROTECT = 6;
const MAX_PREVENT = 2;

const FIXED_TIMES: Record<
  Exclude<Timing, "cleanWindow" | "commute" | "schoolRun" | "exercise">,
  string
> = {
  morning: "07:00",
  afternoon: "16:00",
  evening: "19:00",
  cooking: "19:30",
  night: "21:30",
  anytime: "11:00",
};

/** When in the day an action belongs, for this family and this forecast. */
export function timeFor(ctx: Context, action: ActionDef): string {
  switch (action.timing) {
    case "cleanWindow": {
      const w = ctx.air.windows[0];
      return w ? clock(w.start) : "14:00";
    }
    case "commute":
      return ctx.profile.commute?.leaveAt ?? "08:30";
    case "schoolRun":
      return ctx.profile.schoolRun?.leaveAt ?? "07:30";
    case "exercise":
      return ctx.profile.exercise === "evening" ? "18:00" : "07:00";
    default:
      return FIXED_TIMES[action.timing];
  }
}

/** Keeps the best of each group of alternatives, in ranked order. */
function bestOfGroups(candidates: readonly Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const g = c.action.group;
    if (g === undefined) return true;
    if (seen.has(g)) return false;
    seen.add(g);
    return true;
  });
}

/** Ids of the other actions a family could swap in for this one. */
export function alternativesFor(candidates: readonly Candidate[], actionId: string): string[] {
  const group = actionById(actionId)?.group;
  if (!group) return [];
  return candidates
    .filter((c) => c.action.group === group && c.action.id !== actionId)
    .map((c) => c.action.id);
}

/** On an unhealthy day, one protection for each sensitive member the picks leave out. */
function coverageGaps(
  ctx: Context,
  picked: readonly Candidate[],
  pool: readonly Candidate[],
): Candidate[] {
  if (healthLevel(ctx.air.today.mean) < LEVEL.sensitive) return [];
  const extras: Candidate[] = [];
  for (const m of ctx.profile.members.filter(isSensitive)) {
    const covered = [...picked, ...extras].some((c) => protects(c) && c.who.includes(m.id));
    const extra = covered ? undefined : pool.find((c) => protects(c) && c.who.includes(m.id));
    if (extra) extras.push(extra);
  }
  return extras;
}

const sharedAir = (c: Candidate) => (c.impact.co2kg?.mid ?? 0) + (c.impact.pm25g?.mid ?? 0);

/**
 * The plan Breathprint shows before, or instead of, the model's: safety first,
 * a protection for every sensitive member, then the strongest protections and
 * the biggest cuts to shared air. It never needs the network.
 */
export function selectSteps(ctx: Context, ranked: readonly Candidate[]): Candidate[] {
  const pool = bestOfGroups(ranked);
  const safety = pool.filter((c) => c.action.safety);
  const rest = pool.filter((c) => !c.action.safety);
  const protect = rest.filter(protects).slice(0, MAX_PROTECT);
  const prevent = rest
    .filter((c) => prevents(c) && !protect.includes(c))
    .sort((a, b) => sharedAir(b) - sharedAir(a))
    .slice(0, MAX_PREVENT);
  const gaps = coverageGaps(ctx, [...safety, ...protect], rest);
  return [...new Set([...safety, ...gaps, ...protect, ...prevent])].slice(0, MAX_STEPS);
}

/** Writes a step's one-line reason, in the family's language. */
export type Reasoner = (ctx: Context, candidate: Candidate, time: string) => string;

/** A day plan from the rules alone: the selected steps, timed, reasoned and in clock order. */
export function buildRulePlan(
  ctx: Context,
  ranked: readonly Candidate[],
  headline: string,
  reason: Reasoner,
): DayPlan {
  const steps = selectSteps(ctx, ranked)
    .map((c) => {
      const time = timeFor(ctx, c.action);
      return { actionId: c.action.id, time, who: c.who, reason: reason(ctx, c, time) };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
  return { headline, steps, source: "rules" };
}
