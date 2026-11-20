import { burstExposure, inhalationRate } from "../exposure";
import { type Pick, picker } from "../factors";
import type { Member } from "../profile";
import { airExchange, bedroomGroup, homeAt, protectImpact, ranged, short, total } from "./models";
import type { ActionDef, Context, Impact } from "./types";

/*
 * Smoke a household makes on purpose: the morning agarbatti and the
 * mosquito coil by the bed. Each is one burst in one room, so both read the
 * same box model.
 */

const pickMid = picker("mid");

const UG_PER_MG = 1000;
const MG_PER_G = 1000;

/** One burst of smoke in a closed room: what the people in it breathe, and the grams the street gets. */
function burstImpact(
  ctx: Context,
  people: Member[],
  massMg: (p: Pick) => number,
  room: "roomVolume" | "livingRoomVolume",
  activity: "rest" | "sleep",
): Impact {
  const model = (p: Pick) => {
    const area = burstExposure(
      massMg(p) * UG_PER_MG,
      p(room),
      airExchange(ctx, p),
      p("deposition"),
    );
    return total(
      people.map((m) => ({ exposure: area, dose: area * inhalationRate(m.group, activity) })),
    );
  };
  return protectImpact(
    ctx,
    people,
    model,
    {
      pm25g: ranged((p) => massMg(p) / MG_PER_G),
      method: [
        {
          label: "method.burst",
          formula: "exposure = mass / (V × (a + k))",
          result: `${short(massMg(pickMid))} mg → ${short(model(pickMid).exposure / Math.max(1, people.length))} µg·h/m³ each`,
        },
      ],
    },
    true,
  );
}

/** Light the morning agarbatti on the balcony, not in the living room. */
export const skipIncense: ActionDef = {
  id: "skip-incense",
  ledgers: ["protect", "prevent"],
  category: "home",
  timing: "morning",
  cost: "free",
  sources: ["jetter2002", "chenZhao2011"],
  quantified: true,
  appliesTo: (ctx) => homeAt(ctx, "07:00"),
  eligible: (ctx) => ctx.profile.home.incense,
  impact: (ctx) =>
    burstImpact(
      ctx,
      homeAt(ctx, "07:00"),
      (p) => p("incensePm25PerStick") * p("incenseSticksPerDay"),
      "livingRoomVolume",
      "rest",
    ),
};

/** Swap the mosquito coil for a net or a plug-in, for whoever sleeps beside it. */
export const swapCoil: ActionDef = {
  id: "swap-coil",
  ledgers: ["protect", "prevent"],
  category: "home",
  timing: "night",
  cost: "low",
  sources: ["liu2003", "chenZhao2011"],
  quantified: true,
  appliesTo: bedroomGroup,
  eligible: (ctx) => ctx.profile.home.mosquitoCoil,
  impact: (ctx) =>
    burstImpact(
      ctx,
      bedroomGroup(ctx),
      (p) => p("coilMgPerHour") * p("coilHours"),
      "roomVolume",
      "sleep",
    ),
};
