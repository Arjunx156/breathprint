import { z } from "zod/mini";
import { exertionCeiling } from "./actions/activity";
import { actionById, type Candidate } from "./actions/catalogue";
import type { ActionDef, Context, Timing } from "./actions/types";
import { inWindow, pm25At } from "./air";
import { healthLevel } from "./aqi";
import { clock } from "./format";
import { hasCombustionIndoors, isSensitive } from "./profile";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const text = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));

export const PlanStepSchema = z.object({
  actionId: z.string().check(z.minLength(1), z.maxLength(40)),
  time: z.string().check(z.regex(HHMM)),
  who: z.array(z.string().check(z.maxLength(24))).check(z.maxLength(12)),
  reason: text(300),
});

export const DayPlanSchema = z.object({
  headline: text(160),
  steps: z.array(PlanStepSchema).check(z.minLength(1), z.maxLength(8)),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type DayPlanBody = z.infer<typeof DayPlanSchema>;
export type DayPlan = DayPlanBody & { source: "rules" | "ai" };

/** What /api/plan answers: a plan the model chose, already checked by the server. */
export const PlanReplySchema = z.object({
  plan: z.extend(DayPlanSchema, { source: z.literal("ai") }),
  model: z.string(),
  recorded: z.boolean(),
});

export type PlanReply = z.infer<typeof PlanReplySchema>;

export const MAX_STEPS = 8;
const MAX_PROTECT = 6;
const MAX_PREVENT = 2;

export type IssueCode =
  | "unknownAction"
  | "duplicate"
  | "groupConflict"
  | "unknownMember"
  | "ventilationOutsideWindow"
  | "outdoorExertion"
  | "sealWithCombustion"
  | "sensitiveUncovered"
  | "safetyMissing";

export type PlanIssue = { code: IssueCode; detail: string };

const protects = (c: Candidate) =>
  c.action.ledgers.includes("protect") &&
  (c.impact.dose === null ? !c.action.quantified : c.impact.dose.mid > 0);
const prevents = (c: Candidate) =>
  c.action.ledgers.includes("prevent") &&
  ((c.impact.co2kg?.mid ?? 0) > 0 || (c.impact.pm25g?.mid ?? 0) > 0 || !c.action.quantified);

/** Who a step covers: the members it names, or everyone the action applies to. */
function coverage(step: PlanStep, candidate: Candidate | undefined): string[] {
  return step.who.length > 0 ? step.who : (candidate?.who ?? []);
}

function stepIssues(ctx: Context, step: PlanStep, candidate: Candidate | undefined): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const action = candidate?.action;
  if (!action)
    return [{ code: "unknownAction", detail: `${step.actionId} is not one of today's options.` }];
  const known = new Set(ctx.profile.members.map((m) => m.id));
  const strangers = step.who.filter((id) => !known.has(id));
  if (strangers.length > 0)
    issues.push({
      code: "unknownMember",
      detail: `${step.actionId} names ${strangers.join(", ")}.`,
    });
  if (action.id === "ventilate-window" && !inWindow(ctx.air, step.time)) {
    issues.push({
      code: "ventilationOutsideWindow",
      detail: `Airing at ${step.time} is outside the clean window.`,
    });
  }
  if (action.outdoorExertion) {
    const people = ctx.profile.members.filter((m) => coverage(step, candidate).includes(m.id));
    if (healthLevel(pm25At(ctx.air, step.time)) > exertionCeiling(people)) {
      issues.push({
        code: "outdoorExertion",
        detail: `${step.actionId} at ${step.time} is too polluted for exertion.`,
      });
    }
  }
  if (action.id === "seal-gaps" && hasCombustionIndoors(ctx.profile)) {
    issues.push({
      code: "sealWithCombustion",
      detail: "Never seal a room while something burns indoors.",
    });
  }
  return issues;
}

function planIssues(
  ctx: Context,
  steps: readonly PlanStep[],
  candidates: readonly Candidate[],
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const chosen = steps.map((s) => candidates.find((c) => c.action.id === s.actionId));
  const ids = steps.map((s) => s.actionId);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
    issues.push({ code: "duplicate", detail: `${id} appears twice.` });
  }
  const groups = chosen.map((c) => c?.action.group).filter((g): g is string => g !== undefined);
  for (const g of new Set(groups.filter((g, i) => groups.indexOf(g) !== i))) {
    issues.push({
      code: "groupConflict",
      detail: `Pick one ${g} option and offer the rest as swaps.`,
    });
  }
  for (const c of candidates.filter((c) => c.action.safety && !ids.includes(c.action.id))) {
    issues.push({ code: "safetyMissing", detail: `${c.action.id} must be in the plan.` });
  }
  if (healthLevel(ctx.air.today.mean) >= 2) {
    const covered = new Set(
      steps.flatMap((s, i) => (chosen[i] && protects(chosen[i]) ? coverage(s, chosen[i]) : [])),
    );
    const coverable = new Set(candidates.filter(protects).flatMap((c) => c.who));
    for (const m of ctx.profile.members.filter(
      (m) => isSensitive(m) && coverable.has(m.id) && !covered.has(m.id),
    )) {
      issues.push({
        code: "sensitiveUncovered",
        detail: `Nothing in the plan protects ${m.name ?? m.id}.`,
      });
    }
  }
  return issues;
}

/**
 * Checks a plan, usually one a model wrote, against the rules that keep it
 * safe and grounded. An empty list means it may be shown.
 */
export function checkPlan(
  ctx: Context,
  plan: DayPlanBody,
  candidates: readonly Candidate[],
): PlanIssue[] {
  const byId = new Map(candidates.map((c) => [c.action.id, c]));
  return [
    ...plan.steps.flatMap((s) => stepIssues(ctx, s, byId.get(s.actionId))),
    ...planIssues(ctx, plan.steps, candidates),
  ];
}

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
export function bestOfGroups(candidates: readonly Candidate[]): Candidate[] {
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
  if (healthLevel(ctx.air.today.mean) < 2) return [];
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

export type Reasoner = (ctx: Context, candidate: Candidate, time: string) => string;

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
