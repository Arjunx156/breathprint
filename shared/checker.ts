import { exertionCeiling } from "./actions/activity";
import { type Candidate, protects } from "./actions/catalogue";
import type { Context } from "./actions/types";
import { inWindow, pm25At } from "./air";
import { healthLevel, LEVEL } from "./aqi";
import type { DayPlanBody, PlanStep } from "./plan";
import { hasCombustionIndoors, isSensitive } from "./profile";

/*
 * The rules every plan must pass before a family sees it. The model's plans
 * go through here on the server; the engine's own plan passes them by
 * construction, and the tests hold it to that.
 */

/** Every way a plan can fail the checker. */
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

/** One failure, with a detail the repair prompt can quote back to the model. */
export type PlanIssue = { code: IssueCode; detail: string };

/** Who a step covers: the members it names, or everyone the action applies to. */
function coverage(step: PlanStep, candidate: Candidate | undefined): string[] {
  return step.who.length > 0 ? step.who : (candidate?.who ?? []);
}

/** Issues with one step on its own: an unknown action or person, a bad time, an unsafe pairing. */
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

/** Each value that appears more than once. */
function repeated<T>(values: readonly T[]): T[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
}

/** Sensitive members some protect option could cover, but no chosen step does. */
function uncoveredSensitive(
  ctx: Context,
  steps: readonly PlanStep[],
  chosen: readonly (Candidate | undefined)[],
  candidates: readonly Candidate[],
) {
  if (healthLevel(ctx.air.today.mean) < LEVEL.sensitive) return [];
  const covered = new Set(
    steps.flatMap((step, i) => {
      const candidate = chosen[i];
      return candidate && protects(candidate) ? coverage(step, candidate) : [];
    }),
  );
  const coverable = new Set(candidates.filter(protects).flatMap((c) => c.who));
  return ctx.profile.members.filter(
    (m) => isSensitive(m) && coverable.has(m.id) && !covered.has(m.id),
  );
}

/** Issues of the plan as a whole: repeats, clashing alternatives, a missing safety step, someone left out. */
function planIssues(
  ctx: Context,
  steps: readonly PlanStep[],
  candidates: readonly Candidate[],
): PlanIssue[] {
  const chosen = steps.map((s) => candidates.find((c) => c.action.id === s.actionId));
  const ids = steps.map((s) => s.actionId);
  const groups = chosen.flatMap((c) => (c?.action.group ? [c.action.group] : []));
  const missing = candidates.filter((c) => c.action.safety && !ids.includes(c.action.id));
  return [
    ...repeated(ids).map(
      (id): PlanIssue => ({ code: "duplicate", detail: `${id} appears twice.` }),
    ),
    ...repeated(groups).map(
      (group): PlanIssue => ({
        code: "groupConflict",
        detail: `Pick one ${group} option and offer the rest as swaps.`,
      }),
    ),
    ...missing.map(
      (c): PlanIssue => ({ code: "safetyMissing", detail: `${c.action.id} must be in the plan.` }),
    ),
    ...uncoveredSensitive(ctx, steps, chosen, candidates).map(
      (m): PlanIssue => ({
        code: "sensitiveUncovered",
        detail: `Nothing in the plan protects ${m.name ?? m.id}.`,
      }),
    ),
  ];
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
