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
  skipIncense,
  swapCoil,
  ventilateWindow,
  wetCleaning,
} from "./home";
import {
  carpool,
  carRecirculate,
  combineErrands,
  commuteBus,
  commuteMetro,
  engineOff,
  maskCommute,
  maskSchoolRun,
  schoolCarpool,
  workFromHome,
} from "./travel";
import type { ActionDef, Context, Cost, Impact } from "./types";

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

export type Candidate = {
  action: ActionDef;
  impact: Impact;
  /** Member ids this action covers. */
  who: string[];
  score: number;
};

const COST_PENALTY: Record<Cost, number> = { free: 0, low: 0.02, medium: 0.08, high: 0.15 };
const BUDGET_WEIGHT = { tight: 2, moderate: 1, comfortable: 0.5 } as const;

/**
 * Orders actions by what they do for this family today. Protection weighs more
 * as the air worsens; prevention keeps a floor of 30% so the shared air is
 * never ignored. Safety actions always come first.
 */
function score(ctx: Context, action: ActionDef, impact: Impact): number {
  if (action.safety) return 10;
  const level = healthLevel(ctx.air.today.mean);
  const protectWeight = Math.min(0.7, 0.4 + 0.06 * level);
  const sensitiveShare =
    impact.people.length === 0
      ? 0
      : ctx.profile.members.filter((m) => impact.people.includes(m.id) && isSensitive(m)).length /
        impact.people.length;
  const protect = Math.max(-1, Math.min(1, impact.doseShare ?? 0)) * (1 + 0.5 * sensitiveShare);
  const prevent =
    Math.min(1, Math.max(0, impact.co2kg?.mid ?? 0) / 4) * 0.5 +
    Math.min(1, Math.max(0, impact.pm25g?.mid ?? 0) / 2) * 0.5;
  const qualitative = action.quantified ? 0 : 0.05;
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
