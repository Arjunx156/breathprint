import { z } from "zod/mini";
import { actionById } from "./actions/catalogue";
import { type AirSummary, clockOf, dayOf } from "./air";
import type { Scale } from "./aqi";
import { t, tx } from "./i18n";
import { defaultProfile, type Language, type Place, type Profile } from "./profile";
import { type Range, scale } from "./range";

export const AUDIENCES = ["society", "school", "workplace"] as const;
export const CHANNELS = ["whatsapp", "notice"] as const;
export type Audience = (typeof AUDIENCES)[number];
export type Channel = (typeof CHANNELS)[number];

const line = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));

/** An advisory as written by the model, or by Breathprint's own templates. */
export const AdvisorySchema = z.object({
  headline: line(120),
  situation: line(400),
  do: z.array(line(160)).check(z.minLength(2), z.maxLength(6)),
  avoid: z.array(line(160)).check(z.minLength(1), z.maxLength(5)),
  sensitive: line(400),
});

export type Advisory = z.infer<typeof AdvisorySchema>;

/** The one change each kind of community can make together for the shared air. */
export const SHARED_ACTION: Record<Audience, string> = {
  society: "no-waste-burning",
  school: "school-carpool",
  workplace: "carpool",
};

/** What each audience is told about, most useful first. */
export const AUDIENCE_ACTIONS: Record<Audience, readonly string[]> = {
  society: [
    "no-waste-burning",
    "report-burning",
    "ventilate-window",
    "diy-purifier",
    "skip-incense",
    "wet-cleaning",
    "heater-safety",
  ],
  school: [
    "play-indoors",
    "mask-school-run",
    "school-carpool",
    "exercise-indoors",
    "ventilate-window",
    "diy-purifier",
  ],
  workplace: [
    "work-from-home",
    "commute-metro",
    "carpool",
    "mask-commute",
    "engine-off",
    "ventilate-window",
  ],
};

/**
 * The household a community figure is worked out for, stated beside it on
 * screen: one that makes the trip or burns the waste the shared action stops.
 */
export function typicalHousehold(place: Place, audience: Audience): Profile {
  const base = defaultProfile(place);
  switch (audience) {
    case "society":
      return { ...base, home: { ...base.home, burnsWaste: true } };
    case "school":
      return {
        ...base,
        members: [
          ...base.members,
          { id: "p2", group: "child", conditions: [], outdoorWork: false },
        ],
        schoolRun: { mode: "car", km: 4, leaveAt: "07:30", returnAt: "14:00", who: ["p2"] },
      };
    case "workplace":
      return {
        ...base,
        commute: { mode: "car", km: 12, leaveAt: "09:00", returnAt: "18:30", who: ["me"] },
      };
  }
}

const RangeSchema = z.object({ low: z.number(), mid: z.number(), high: z.number() });

export const CollectiveSchema = z.object({
  actionId: z.string(),
  households: z.number(),
  co2kg: z.nullable(RangeSchema),
  pm25g: z.nullable(RangeSchema),
});

export type Collective = z.infer<typeof CollectiveSchema>;

/** The distance the community figure assumes, said beside it so nobody reads it as theirs. */
export function basisKm(place: Place, audience: Audience): number | null {
  const household = typicalHousehold(place, audience);
  return (household.schoolRun ?? household.commute)?.km ?? null;
}

/**
 * What `households` families taking the shared action keep out of the air in
 * a day. It is emissions avoided, never a promise about the city's AQI.
 */
export function collective(
  air: AirSummary,
  place: Place,
  audience: Audience,
  households: number,
): Collective | null {
  const ctx = { profile: typicalHousehold(place, audience), air };
  const action = actionById(SHARED_ACTION[audience]);
  if (!action?.eligible(ctx)) return null;
  const impact = action.impact(ctx);
  const total = (r: Range | null) => (r && r.mid > 0 ? scale(r, households) : null);
  const co2kg = total(impact.co2kg);
  const pm25g = total(impact.pm25g);
  if (!co2kg && !pm25g) return null;
  return { actionId: action.id, households, co2kg, pm25g };
}

/**
 * Breathprint's own advisory, from templates and the engine's numbers, for
 * when the model can't write one. It says less, but nothing in it is guessed.
 */
export function templateAdvisory(
  lang: Language,
  air: AirSummary,
  place: Place,
  aqiScale: Scale,
  audience: Audience,
): Advisory {
  const reading = air.current.aqi[aqiScale];
  const category = tx(lang, `aqi.${aqiScale}.${reading.category}`);
  const today = dayOf(air.now);
  const window = air.flat ? undefined : air.windows.find((w) => dayOf(w.start) === today);
  const vars = { category: category.toLowerCase(), aqi: reading.value };
  return {
    headline: t(lang, "advisory.headline", { category, place: place.name }),
    situation: window
      ? t(lang, "advisory.situation", {
          ...vars,
          from: clockOf(window.start),
          to: clockOf(window.end),
        })
      : t(lang, "advisory.situationFlat", vars),
    do: AUDIENCE_ACTIONS[audience].slice(0, 4).map((id) => tx(lang, `action.${id}.title`)),
    avoid: [t(lang, "advisory.avoid.burning"), t(lang, "advisory.avoid.exercise")],
    sensitive: t(lang, "advisory.sensitive"),
  };
}
