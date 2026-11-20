import { pm25At } from "../air";
import { healthLevel, LEVEL } from "../aqi";
import { legHours, OPEN_MODES } from "../exposure";
import { type Pick, picker } from "../factors";
import type { Trip } from "../profile";
import {
  exposed,
  onTrip,
  protectImpact,
  ranged,
  short,
  times,
  total,
  tripExposure,
  tripMembers,
} from "./models";
import type { ActionDef, Context, Impact } from "./types";

/*
 * Protect actions for the trips a household already makes: a mask on the
 * open-air legs, and recirculation in the car.
 */

const pickMid = picker("mid");

/** One N95 lasts this many days of trips; n95Inr's note says "reused for a few days". */
const N95_DAYS_WORN = 3;

/** N95 or FFP2 on open-air legs. Infants never wear masks. */
function maskImpact(ctx: Context, trip: Trip): Impact {
  const people = tripMembers(ctx, trip, { masks: true });
  const model = (p: Pick) =>
    total(
      people.map((member) =>
        times(tripExposure(ctx, member, trip, trip.mode, p), 1 - p("maskLeakage")),
      ),
    );
  return protectImpact(ctx, people, model, {
    inrPerDay: ranged((p) => -(p("n95Inr") * people.length) / N95_DAYS_WORN),
    method: [
      {
        label: "method.mask",
        formula: "trip dose × (1 − inward leakage)",
        result: `${short(pm25At(ctx.air, trip.leaveAt))} µg/m³ outside, ${Math.round((1 - pickMid("maskLeakage")) * 100)}% blocked`,
      },
    ],
  });
}

/** A walk, cycle or open vehicle leaving into air that is unhealthy for sensitive people. */
const openTrip = (ctx: Context, trip: Trip | null): trip is Trip =>
  trip !== null &&
  OPEN_MODES.has(trip.mode) &&
  healthLevel(pm25At(ctx.air, trip.leaveAt)) >= LEVEL.sensitive;

/** N95 masks on an open-air school run, when the air at leaving time is unhealthy for sensitive groups. */
export const maskSchoolRun: ActionDef = {
  id: "mask-school-run",
  ledgers: ["protect"],
  category: "travel",
  timing: "schoolRun",
  cost: "low",
  sources: ["cherrie2018", "goel2015", "epaEfh2011"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.schoolRun, { masks: true }),
  eligible: (ctx) => openTrip(ctx, ctx.profile.schoolRun),
  impact: (ctx) => onTrip(ctx.profile.schoolRun, (trip) => maskImpact(ctx, trip)),
};

/** An N95 on an open-air commute, on the same terms as the school run. */
export const maskCommute: ActionDef = {
  id: "mask-commute",
  ledgers: ["protect"],
  category: "travel",
  timing: "commute",
  cost: "low",
  sources: ["cherrie2018", "goel2015", "epaEfh2011"],
  quantified: true,
  appliesTo: (ctx) => tripMembers(ctx, ctx.profile.commute, { masks: true }),
  eligible: (ctx) => openTrip(ctx, ctx.profile.commute),
  impact: (ctx) => onTrip(ctx.profile.commute, (trip) => maskImpact(ctx, trip)),
};

const carTrips = (ctx: Context): Trip[] =>
  [ctx.profile.commute, ctx.profile.schoolRun].filter((trip): trip is Trip => trip?.mode === "car");

/** Recirculating instead of open vents, on every car trip the household makes. */
function recirculateImpact(ctx: Context): Impact {
  const trips = carTrips(ctx);
  const people = [
    ...new Map(trips.flatMap((trip) => tripMembers(ctx, trip)).map((m) => [m.id, m])).values(),
  ];
  const model = (p: Pick) =>
    total(
      trips.flatMap((trip) =>
        tripMembers(ctx, trip).map((member) => {
          const hours = legHours("car", trip.km, p);
          // Each leg takes `hours`, so summing both legs' air covers the round trip.
          const ambient = pm25At(ctx.air, trip.leaveAt) + pm25At(ctx.air, trip.returnAt);
          return exposed(member, ambient * (p("ratioCarOpen") - p("ratioCarAc")), hours, "rest");
        }),
      ),
    );
  return protectImpact(ctx, people, model, {
    method: [
      {
        label: "method.recirculate",
        formula: `C_out × (${pickMid("ratioCarOpen")} open − ${pickMid("ratioCarAc")} recirculating) × time`,
        result: `${short(model(pickMid).dose)} µg`,
      },
    ],
  });
}

/** Windows up and air on recirculate, on every car trip the household makes. */
export const carRecirculate: ActionDef = {
  id: "car-recirculate",
  ledgers: ["protect"],
  category: "travel",
  timing: "commute",
  cost: "free",
  sources: ["goel2015", "epaEfh2011"],
  quantified: true,
  appliesTo: (ctx) => carTrips(ctx).flatMap((trip) => tripMembers(ctx, trip)),
  eligible: (ctx) => carTrips(ctx).length > 0,
  impact: recirculateImpact,
};
