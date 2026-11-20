import { pm25At } from "../air";
import { healthLevel, LEVEL } from "../aqi";
import { type Pick, picker } from "../factors";
import { clock } from "../format";
import { hasCombustionHeating, isSensitive, type Member } from "../profile";
import { exposed, homeIndoor, impact, protectImpact, ranged, short, total } from "./models";
import type { ActionDef, Context } from "./types";

const pickMid = picker("mid");
const EXERCISE_MINUTES = 45;
const EXERCISE_HOURS = EXERCISE_MINUTES / 60;
const PLAY_HOURS = 1;

const exerciseClock = (ctx: Context) => (ctx.profile.exercise === "evening" ? "18:00" : "07:00");
const exercisers = (ctx: Context): Member[] =>
  ctx.profile.members.filter((m) => m.group === "adult" || m.group === "teen").slice(0, 2);
const players = (ctx: Context): Member[] =>
  ctx.profile.members.filter((m) => m.group === "child" || m.group === "teen");

/** The highest health level at which a group should exert itself outdoors. */
export function exertionCeiling(people: readonly Member[]): number {
  return people.some(isSensitive) ? 1 : 2;
}

/** Exercise indoors when the air at the usual hour is unhealthy for sensitive people. */
export const exerciseIndoors: ActionDef = {
  id: "exercise-indoors",
  group: "exercise",
  ledgers: ["protect"],
  category: "activity",
  timing: "morning",
  cost: "free",
  sources: ["epaEfh2011", "goel2015", "epaSchools"],
  quantified: true,
  appliesTo: exercisers,
  eligible: (ctx) =>
    ctx.profile.exercise !== "none" &&
    healthLevel(pm25At(ctx.air, exerciseClock(ctx))) >= LEVEL.sensitive,
  impact: (ctx) => {
    const people = exercisers(ctx);
    const outdoor = pm25At(ctx.air, exerciseClock(ctx));
    const model = (p: Pick) => {
      const delta = outdoor * p("ratioWalk") - homeIndoor(ctx, outdoor, p);
      return total(people.map((m) => exposed(m, delta, EXERCISE_HOURS, "moderate")));
    };
    return protectImpact(ctx, people, model, {
      method: [
        {
          label: "method.exercise",
          formula: `(roadside − indoor) × moderate breathing × ${EXERCISE_MINUTES} min`,
          result: `${short(outdoor * pickMid("ratioWalk"))} → ${short(homeIndoor(ctx, outdoor, pickMid))} µg/m³`,
        },
      ],
    });
  },
};

/** Move a walk or run into today's clean window, when that window is clean enough for every exerciser. */
export const exerciseWindow: ActionDef = {
  id: "exercise-window",
  group: "exercise",
  ledgers: ["protect"],
  category: "activity",
  timing: "cleanWindow",
  cost: "free",
  sources: ["epaEfh2011", "goel2015", "epaSchools"],
  outdoorExertion: true,
  quantified: true,
  appliesTo: exercisers,
  eligible: (ctx) => {
    const clean = ctx.air.windows[0];
    return (
      ctx.profile.exercise !== "none" &&
      clean !== undefined &&
      healthLevel(clean.meanPm25) <= exertionCeiling(exercisers(ctx))
    );
  },
  impact: (ctx) => {
    const clean = ctx.air.windows[0];
    if (!clean) return impact({});
    const people = exercisers(ctx);
    const usual = pm25At(ctx.air, exerciseClock(ctx));
    const model = (p: Pick) =>
      total(
        people.map((m) =>
          exposed(m, (usual - clean.meanPm25) * p("ratioWalk"), EXERCISE_HOURS, "moderate"),
        ),
      );
    return protectImpact(ctx, people, model, {
      method: [
        {
          label: "method.exerciseShift",
          formula: `(usual hour − clean window) × roadside ratio × ${EXERCISE_MINUTES} min`,
          result: `${short(usual)} → ${short(clean.meanPm25)} µg/m³ at ${clock(clean.start)}`,
        },
      ],
    });
  },
};

/** Indoor play for the children when the air at five in the evening is unhealthy for sensitive groups. */
export const playIndoors: ActionDef = {
  id: "play-indoors",
  ledgers: ["protect"],
  category: "activity",
  timing: "afternoon",
  cost: "free",
  sources: ["epaSchools", "epaEfh2011"],
  quantified: true,
  appliesTo: players,
  eligible: (ctx) =>
    players(ctx).length > 0 && healthLevel(pm25At(ctx.air, "17:00")) >= LEVEL.sensitive,
  impact: (ctx) => {
    const people = players(ctx);
    const outdoor = pm25At(ctx.air, "17:00");
    const model = (p: Pick) => {
      const delta = outdoor - homeIndoor(ctx, outdoor, p);
      return total(people.map((m) => exposed(m, delta, PLAY_HOURS, "moderate")));
    };
    return protectImpact(ctx, people, model, {
      method: [
        {
          label: "method.play",
          formula: "(outdoor − indoor) × active breathing × 1 h",
          result: `${short(outdoor)} → ${short(homeIndoor(ctx, outdoor, pickMid))} µg/m³`,
        },
      ],
    });
  },
};

/** Bag the leaves and rubbish a household burns: the grams of PM2.5 the street no longer gets. */
export const noWasteBurning: ActionDef = {
  id: "no-waste-burning",
  ledgers: ["prevent"],
  category: "community",
  timing: "anytime",
  cost: "free",
  sources: ["akagi2011"],
  quantified: true,
  appliesTo: () => [],
  eligible: (ctx) => ctx.profile.home.burnsWaste,
  impact: () =>
    impact({
      pm25g: ranged((p) => p("wasteKgPerDay") * p("garbagePm25PerKg")),
      method: [
        {
          label: "method.burning",
          formula: `kg burned × ${pickMid("garbagePm25PerKg")} g PM2.5 per kg`,
          result: `${short(pickMid("wasteKgPerDay") * pickMid("garbagePm25PerKg"))} g`,
        },
      ],
    }),
};

/** Report open burning nearby on an unhealthy day; advice with no figure of its own. */
export const reportBurning: ActionDef = {
  id: "report-burning",
  ledgers: ["prevent"],
  category: "community",
  timing: "anytime",
  cost: "free",
  sources: ["akagi2011", "caqmGrap"],
  quantified: false,
  appliesTo: () => [],
  eligible: (ctx) =>
    healthLevel(ctx.air.today.mean) >= LEVEL.unhealthy && !ctx.profile.home.burnsWaste,
  impact: () => impact({}),
};

/** Keep an angithi, kerosene or gas heater out of sleeping rooms. Always in the plan when one is used. */
export const heaterSafety: ActionDef = {
  id: "heater-safety",
  ledgers: ["protect"],
  category: "safety",
  timing: "night",
  cost: "free",
  sources: ["cdcCo"],
  safety: true,
  quantified: false,
  appliesTo: (ctx) => ctx.profile.members,
  eligible: (ctx) => hasCombustionHeating(ctx.profile),
  impact: () => impact({}),
};

/** A cleaner fuel, or cooking outside, for a biomass or kerosene stove. Always in the plan when one is used. */
export const cleanerCooking: ActionDef = {
  id: "cleaner-cooking",
  ledgers: ["protect", "prevent"],
  category: "safety",
  timing: "cooking",
  cost: "medium",
  sources: ["whoAqg2021", "cdcCo"],
  safety: true,
  quantified: false,
  appliesTo: (ctx) => ctx.profile.members,
  eligible: (ctx) =>
    ctx.profile.home.cooking === "biomass" || ctx.profile.home.cooking === "kerosene",
  impact: () => impact({}),
};

/** Lid on and exhaust on while cooking, for any flame without a chimney. */
export const cookingVent: ActionDef = {
  id: "cooking-vent",
  ledgers: ["protect"],
  category: "home",
  timing: "cooking",
  cost: "free",
  sources: ["epaPurifier"],
  quantified: false,
  appliesTo: (ctx) => ctx.profile.members,
  eligible: (ctx) => !ctx.profile.home.chimney && ctx.profile.home.cooking !== "electric",
  impact: () => impact({}),
};

/** Smoke outside and away from the door, in a home where someone smokes. */
export const smokeOutside: ActionDef = {
  id: "smoke-outside",
  ledgers: ["protect"],
  category: "home",
  timing: "anytime",
  cost: "free",
  sources: ["whoAqg2021"],
  quantified: false,
  appliesTo: (ctx) => ctx.profile.members,
  eligible: (ctx) => ctx.profile.home.smoking,
  impact: () => impact({}),
};
