import { pm25At } from "../air";
import { healthLevel, LEVEL } from "../aqi";
import { hoursAway } from "../exposure";
import { type FactorId, type Pick, picker } from "../factors";
import { clock } from "../format";
import { hasCombustionIndoors, type Member } from "../profile";
import { HOURS_PER_DAY } from "../time";
import {
  airExchange,
  bedroomGroup,
  exposed,
  homeAt,
  homeIndoor,
  impact,
  overnight,
  protectImpact,
  ranged,
  runningCo2,
  runningCost,
  short,
  total,
} from "./models";
import type { ActionDef, Context, Impact } from "./types";

const SLEEP_HOURS = 9;
const pickMid = picker("mid");

function filterImpact(ctx: Context, cadr: FactorId, watts: FactorId, build?: FactorId): Impact {
  const people = bedroomGroup(ctx);
  const outdoor = overnight(ctx);
  const model = (p: Pick) => {
    const delta = homeIndoor(ctx, outdoor, p) - homeIndoor(ctx, outdoor, p, p(cadr));
    return total(people.map((m) => exposed(m, delta, SLEEP_HOURS, "sleep")));
  };
  const before = homeIndoor(ctx, outdoor, pickMid);
  const after = homeIndoor(ctx, outdoor, pickMid, pickMid(cadr));
  return protectImpact(ctx, people, model, {
    co2kg: runningCo2(watts, SLEEP_HOURS),
    inrPerDay: runningCost(watts, SLEEP_HOURS),
    inrOnce: build ? ranged((p) => p(build)) : null,
    method: [
      {
        label: "method.bedroomOvernight",
        formula: "C_in = P·a·C_out / (a + k + CADR/V)",
        result: `${short(before)} → ${short(after)} µg/m³`,
      },
      {
        label: "method.doseSleep",
        formula: `ΔC × breathing rate × ${SLEEP_HOURS} h × ${people.length}`,
        result: `${short(model(pickMid).dose)} µg`,
      },
    ],
  });
}

/** Run the family's own purifier in the room where its most sensitive members sleep. */
export const purifierNight: ActionDef = {
  id: "purifier-night",
  group: "bedroomFilter",
  ledgers: ["protect"],
  category: "home",
  timing: "night",
  cost: "free",
  sources: ["chenZhao2011", "ncceh2023", "epaEfh2011"],
  quantified: true,
  appliesTo: bedroomGroup,
  eligible: (ctx) => ctx.profile.home.purifier,
  impact: (ctx) => filterImpact(ctx, "purifierCadr", "purifierWatts"),
};

/** Build a box-fan purifier for the bedroom, for a home without one. */
export const diyPurifier: ActionDef = {
  id: "diy-purifier",
  group: "bedroomFilter",
  ledgers: ["protect"],
  category: "home",
  timing: "night",
  cost: "medium",
  sources: ["ncceh2023", "dalPorto2022", "chenZhao2011"],
  quantified: true,
  appliesTo: bedroomGroup,
  // A build costs money, so it is only suggested for nights unhealthy for sensitive groups.
  eligible: (ctx) => !ctx.profile.home.purifier && healthLevel(overnight(ctx)) >= LEVEL.sensitive,
  impact: (ctx) => filterImpact(ctx, "boxFanCadr", "boxFanWatts", "boxFanBuildInr"),
};

const MORNING_AIRING = "08:00";
const AIRING_HOURS = 0.5;
/** Moving the airing is worth a step when the morning is 20% dirtier than the window. */
const WORTH_MOVING = 1.2;

/**
 * Airing the house resets indoor air to roughly the outdoor level; after the
 * windows shut it decays back with time constant 1 / (a + k). The excess
 * exposure is (C_out - C_in) x (open time + 1 / (a + k)).
 */
function airingExcess(ctx: Context, people: readonly Member[], outdoor: number, p: Pick) {
  const settled = homeIndoor(ctx, outdoor, p);
  const decay = 1 / (airExchange(ctx, p) + p("deposition"));
  const delta = Math.max(0, outdoor - settled);
  return total(people.map((m) => exposed(m, delta, AIRING_HOURS + decay, "rest")));
}

/** Air the house in the clean window instead of the morning, when the morning is clearly dirtier. */
export const ventilateWindow: ActionDef = {
  id: "ventilate-window",
  ledgers: ["protect"],
  category: "home",
  timing: "cleanWindow",
  cost: "free",
  sources: ["chenZhao2011", "openMeteo"],
  quantified: true,
  appliesTo: (ctx) => {
    const clean = ctx.air.windows[0];
    return clean ? homeAt(ctx, clock(clean.start)) : [];
  },
  eligible: (ctx) => {
    const clean = ctx.air.windows[0];
    return clean !== undefined && pm25At(ctx.air, MORNING_AIRING) > clean.meanPm25 * WORTH_MOVING;
  },
  impact: (ctx) => {
    const clean = ctx.air.windows[0];
    if (!clean) return impact({});
    const morningPeople = homeAt(ctx, MORNING_AIRING);
    const windowPeople = homeAt(ctx, clock(clean.start));
    const morning = pm25At(ctx.air, MORNING_AIRING);
    const model = (p: Pick) => {
      const before = airingExcess(ctx, morningPeople, morning, p);
      const after = airingExcess(ctx, windowPeople, clean.meanPm25, p);
      return { exposure: before.exposure - after.exposure, dose: before.dose - after.dose };
    };
    return protectImpact(ctx, morningPeople, model, {
      method: [
        {
          label: "method.airingSwap",
          formula: `(C_out − C_in) × (${AIRING_HOURS} h + 1/(a + k))`,
          result: `${short(morning)} → ${short(clean.meanPm25)} µg/m³ outside`,
        },
      ],
    });
  },
};

const TIGHTER: Record<Context["profile"]["home"]["tightness"], FactorId | null> = {
  leaky: "airExchangeAverage",
  average: "airExchangeTight",
  tight: null,
};

/** Tighten a leaky or average home by one step, so less of the street's air gets in. */
export const sealGaps: ActionDef = {
  id: "seal-gaps",
  ledgers: ["protect"],
  category: "home",
  timing: "morning",
  cost: "low",
  sources: ["chenZhao2011", "epaEfh2011"],
  quantified: true,
  appliesTo: (ctx) => ctx.profile.members,
  eligible: (ctx) =>
    TIGHTER[ctx.profile.home.tightness] !== null && !hasCombustionIndoors(ctx.profile),
  impact: (ctx) => {
    const tighter = TIGHTER[ctx.profile.home.tightness];
    if (!tighter) return impact({});
    const outdoor = ctx.air.today.mean;
    const people = ctx.profile.members;
    const room = (p: Pick, a: number) => (p("penetration") * a * outdoor) / (a + p("deposition"));
    const model = (p: Pick) => {
      const delta = room(p, airExchange(ctx, p)) - room(p, p(tighter));
      return total(
        people.map((m) => exposed(m, delta, HOURS_PER_DAY - hoursAway(ctx.profile, m), "rest")),
      );
    };
    return protectImpact(ctx, people, model, {
      inrOnce: ranged((p) => p("sealKitInr")),
      method: [
        {
          label: "method.sealing",
          formula: "C_in = P·a·C_out / (a + k), a lowered one step",
          result: `${short(room(pickMid, airExchange(ctx, pickMid)))} → ${short(room(pickMid, pickMid(tighter)))} µg/m³`,
        },
      ],
    });
  },
};

/** Heat one room on a timer instead of several: the kWh, CO2 and rupees an electric heater saves. */
export const heatOneRoom: ActionDef = {
  id: "heat-one-room",
  ledgers: ["prevent"],
  category: "home",
  timing: "evening",
  cost: "free",
  sources: ["ceaCo2v22"],
  quantified: true,
  appliesTo: () => [],
  eligible: (ctx) => ctx.profile.home.heating === "electric",
  impact: () =>
    impact({
      co2kg: ranged((p) => p("heaterKwhSaved") * p("gridCo2PerKwh")),
      inrPerDay: ranged((p) => p("heaterKwhSaved") * p("electricityInrPerKwh")),
      method: [
        {
          label: "method.electricity",
          formula: "kWh saved × grid factor",
          result: `${short(pickMid("heaterKwhSaved"))} kWh × ${pickMid("gridCo2PerKwh")} kg/kWh`,
        },
      ],
    }),
};

/** Mop and wipe instead of sweeping on an unhealthy day, so settled dust stays down. */
export const wetCleaning: ActionDef = {
  id: "wet-cleaning",
  ledgers: ["protect"],
  category: "home",
  timing: "afternoon",
  cost: "free",
  sources: ["epaPurifier"],
  quantified: false,
  appliesTo: (ctx) => ctx.profile.members,
  eligible: (ctx) => healthLevel(ctx.air.today.mean) >= LEVEL.unhealthy,
  impact: () => impact({}),
};
