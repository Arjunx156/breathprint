import { healthLevel } from "../aqi";
import { isSensitive } from "../profile";
import {
  cleanerCooking,
  cookingVent,
  exerciseIndoors,
  exerciseWindow,
  heaterSafety,
  noWasteBurning,
  playIndoors,
  reportBurning,
  smokeOutside,
} from "./activity";
import {
  diyPurifier,
  heatOneRoom,
  purifierNight,
  sealGaps,
  ventilateWindow,
  wetCleaning,
} from "./home";
import { skipIncense, swapCoil } from "./smoke";
import {
  carpool,
  combineErrands,
  commuteBus,
  commuteMetro,
  engineOff,
  schoolCarpool,
  workFromHome,
} from "./travel";
import { carRecirculate, maskCommute, maskSchoolRun } from "./tripProtect";
import type { ActionDef, Context, Cost, Impact } from "./types";

/** Every action Breathprint can suggest, safety first; the planner and the checker read only this. */
export const CATALOGUE: readonly ActionDef[] = [
  heaterSafety,
  cleanerCooking,
  purifierNight,
  diyPurifier,
  ventilateWindow,
  sealGaps,
  skipIncense,
  swapCoil,
  cookingVent,
  smokeOutside,
  wetCleaning,
  heatOneRoom,
  maskSchoolRun,
  maskCommute,
  carRecirculate,
  commuteMetro,
  commuteBus,
  carpool,
  schoolCarpool,
  workFromHome,
  combineErrands,
  engineOff,
  exerciseIndoors,
  exerciseWindow,
  playIndoors,
  noWasteBurning,
  reportBurning,
];

const BY_ID = new Map(CATALOGUE.map((a) => [a.id, a]));

/** The catalogue entry for an id, or undefined when no action has it. */
export function actionById(id: string): ActionDef | undefined {
  return BY_ID.get(id);
}

/** An action that fits this family today, with its impact and its rank. */
export type Candidate = {
  action: ActionDef;
  impact: Impact;
  /** Member ids this action covers. */
  who: string[];
  score: number;
};

/** Whether a candidate protects anyone today: it lowers a dose, or it is advice with no number. */
export const protects = (c: Candidate) =>
  c.action.ledgers.includes("protect") &&
  (c.impact.dose === null ? !c.action.quantified : c.impact.dose.mid > 0);
/** Whether a candidate cuts what the household adds to the street's air. */
export const prevents = (c: Candidate) =>
  c.action.ledgers.includes("prevent") &&
  ((c.impact.co2kg?.mid ?? 0) > 0 || (c.impact.pm25g?.mid ?? 0) > 0 || !c.action.quantified);

/** Safety actions outrank everything else. */
const SAFETY_SCORE = 10;
/** Protection's share of a score: 40% on the cleanest day, 6 points more a level, never past 70%. */
const PROTECT_SHARE = { base: 0.4, perLevel: 0.06, max: 0.7 };
/** Protecting a sensitive member counts half as much again. */
const SENSITIVE_BONUS = 0.5;
/** A day's cut that earns full marks for prevention, split evenly between CO2 and PM2.5. */
const FULL_CUT = { co2kg: 4, pm25g: 2 };
/** Advice without a number still earns a little, so it isn't always last. */
const QUALITATIVE_SCORE = 0.05;
const COST_PENALTY: Record<Cost, number> = { free: 0, low: 0.02, medium: 0.08, high: 0.15 };
/** How much cost matters for each budget. */
const BUDGET_WEIGHT = { tight: 2, moderate: 1, comfortable: 0.5 } as const;

/** Clamps `n` into [low, high]. */
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/**
 * Orders actions by what they do for this family today. Protection weighs more
 * as the air worsens; prevention keeps a floor of 30% so the shared air is
 * never ignored. Safety actions always come first.
 */
function score(ctx: Context, action: ActionDef, impact: Impact): number {
  if (action.safety) return SAFETY_SCORE;
  const level = healthLevel(ctx.air.today.mean);
  const protectWeight = Math.min(
    PROTECT_SHARE.max,
    PROTECT_SHARE.base + PROTECT_SHARE.perLevel * level,
  );
  const sensitiveShare =
    impact.people.length === 0
      ? 0
      : ctx.profile.members.filter((m) => impact.people.includes(m.id) && isSensitive(m)).length /
        impact.people.length;
  const protect = clamp(impact.doseShare ?? 0, -1, 1) * (1 + SENSITIVE_BONUS * sensitiveShare);
  const prevent =
    (clamp((impact.co2kg?.mid ?? 0) / FULL_CUT.co2kg, 0, 1) +
      clamp((impact.pm25g?.mid ?? 0) / FULL_CUT.pm25g, 0, 1)) /
    2;
  const qualitative = action.quantified ? 0 : QUALITATIVE_SCORE;
  const penalty = COST_PENALTY[action.cost] * BUDGET_WEIGHT[ctx.profile.budget];
  return protectWeight * protect + (1 - protectWeight) * prevent + qualitative - penalty;
}

/** Every action that applies to this family today, best first. */
export function rankActions(ctx: Context): Candidate[] {
  return CATALOGUE.filter((a) => a.eligible(ctx))
    .map((action) => {
      const impact = action.impact(ctx);
      return {
        action,
        impact,
        who: action.appliesTo(ctx).map((m) => m.id),
        score: score(ctx, action, impact),
      };
    })
    .sort((a, b) => b.score - a.score);
}
