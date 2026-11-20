import { z } from "zod/mini";
import { oneDecimal } from "./format";

/** Age groups, each with its own breathing rates. */
export const AGE_GROUPS = ["infant", "child", "teen", "adult", "older"] as const;
/** Conditions that make a member sensitive to smoke. */
export const CONDITIONS = ["asthma", "copd", "heart", "pregnant"] as const;
/** Ways a trip can be made, each with its own exposure and emissions. */
export const TRAVEL_MODES = [
  "car",
  "twoWheeler",
  "auto",
  "bus",
  "metro",
  "walk",
  "cycle",
  "none",
] as const;
/** Cooking fuels, from the cleanest to the smokiest. */
export const COOKING_FUELS = ["lpg", "png", "electric", "biomass", "kerosene"] as const;
/** Heating; the combustion kinds carry a carbon monoxide risk. */
export const HEATING = ["none", "electric", "angithi", "kerosene", "gasHeater"] as const;
/** How much of the street's air a home lets in. */
export const TIGHTNESS = ["leaky", "average", "tight"] as const;
/** How much cost should weigh against benefit. */
export const BUDGETS = ["tight", "moderate", "comfortable"] as const;
/** The interface and the model both speak English and Hindi. */
export const LANGUAGES = ["en", "hi"] as const;
/** When the household usually exercises outdoors, if at all. */
export const EXERCISE = ["none", "morning", "evening"] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];
export type TravelMode = (typeof TRAVEL_MODES)[number];
export type Language = (typeof LANGUAGES)[number];

/** The most people one household holds; setup offers no more and the schema takes no more. */
export const MAX_MEMBERS = 12;
/** A member's name, which stays in the browser, fits a first name and a little more. */
export const MAX_NAME_CHARS = 40;
/** The longest daily trip, each way, that setup and the schema accept. */
export const MAX_TRIP_KM = 80;
/** A place search needs a couple of letters and fits a locality and its city. */
export const SEARCH_CHARS = { min: 2, max: 60 } as const;

const time = z.string().check(z.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM"));

/** One person in the household; the name never leaves the browser. */
export const MemberSchema = z.object({
  id: z.string().check(z.regex(/^[a-z0-9-]{1,24}$/)),
  name: z.optional(z.string().check(z.trim(), z.maxLength(MAX_NAME_CHARS))),
  group: z.enum(AGE_GROUPS),
  conditions: z._default(z.array(z.enum(CONDITIONS)).check(z.maxLength(4)), []),
  outdoorWork: z._default(z.boolean(), false),
});

/** A daily trip there and back, and who makes it. */
export const TripSchema = z.object({
  mode: z.enum(TRAVEL_MODES),
  km: z.number().check(z.gte(0), z.lte(MAX_TRIP_KM)),
  leaveAt: time,
  returnAt: time,
  /** Ids of members who make this trip. */
  who: z.array(z.string()).check(z.maxLength(MAX_MEMBERS)),
});

/** A place, rounded to the forecast grid before it reaches the server. */
export const PlaceSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1), z.maxLength(80)),
  lat: z.number().check(z.gte(-90), z.lte(90)),
  lon: z.number().check(z.gte(-180), z.lte(180)),
  /** ISO 3166 alpha-2. */
  country: z.string().check(z.regex(/^[A-Z]{2}$/)),
});

/** A household as the browser keeps it: who lives there, the home and the trips. */
export const ProfileSchema = z.object({
  version: z.literal(1),
  place: PlaceSchema,
  members: z.array(MemberSchema).check(z.minLength(1), z.maxLength(MAX_MEMBERS)),
  home: z.object({
    tightness: z.enum(TIGHTNESS),
    purifier: z.boolean(),
    cooking: z.enum(COOKING_FUELS),
    chimney: z.boolean(),
    heating: z.enum(HEATING),
    incense: z.boolean(),
    mosquitoCoil: z.boolean(),
    smoking: z.boolean(),
    burnsWaste: z.boolean(),
  }),
  commute: z.nullable(TripSchema),
  schoolRun: z.nullable(TripSchema),
  exercise: z.enum(EXERCISE),
  budget: z.enum(BUDGETS),
  language: z.enum(LANGUAGES),
  scale: z.enum(["IN", "US"]),
  /** Consent to send the household, without names, to Gemini for a personal plan. */
  ai: z._default(z.boolean(), false),
});

export type Member = z.infer<typeof MemberSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Profile = z.infer<typeof ProfileSchema>;

const SENSITIVE_GROUPS: ReadonlySet<AgeGroup> = new Set(["infant", "child", "older"]);

/** People whose lungs or hearts take more harm from the same air. */
export function isSensitive(member: Member): boolean {
  return SENSITIVE_GROUPS.has(member.group) || member.conditions.length > 0;
}

/** Whether the home heats by burning fuel indoors, which adds carbon monoxide to the smoke. */
export function hasCombustionHeating(profile: Profile): boolean {
  return (
    profile.home.heating === "angithi" ||
    profile.home.heating === "kerosene" ||
    profile.home.heating === "gasHeater"
  );
}

/** Whether a fuel-burning heater or a biomass or kerosene stove runs indoors. */
export function hasCombustionIndoors(profile: Profile): boolean {
  return (
    hasCombustionHeating(profile) ||
    profile.home.cooking === "biomass" ||
    profile.home.cooking === "kerosene"
  );
}

/** How far 0.1 degree of latitude spans, for telling people how coarse their location is. */
export const GRID_KM = 11;

/** Rounds to 0.1 degree (about 11 km) so the server never learns a precise address. */
export function coarse(value: number): number {
  return oneDecimal(value);
}

/** A household nobody has described yet: one adult, average home, no trips. */
export function defaultProfile(place: Place): Profile {
  return {
    version: 1,
    place,
    members: [{ id: "me", group: "adult", conditions: [], outdoorWork: false }],
    home: {
      tightness: "average",
      purifier: false,
      cooking: "lpg",
      chimney: false,
      heating: "none",
      incense: false,
      mosquitoCoil: false,
      smoking: false,
      burnsWaste: false,
    },
    commute: null,
    schoolRun: null,
    exercise: "none",
    budget: "moderate",
    language: "en",
    scale: place.country === "IN" ? "IN" : "US",
    ai: false,
  };
}

/** The demo household: Meera's family in Rohini, Delhi. */
export const MEERA: Profile = {
  version: 1,
  place: { name: "Rohini, Delhi", lat: 28.7, lon: 77.1, country: "IN" },
  members: [
    { id: "me", name: "Meera", group: "adult", conditions: [], outdoorWork: false },
    { id: "p2", name: "Rohan", group: "adult", conditions: [], outdoorWork: false },
    { id: "p3", name: "Kabir", group: "child", conditions: ["asthma"], outdoorWork: false },
    { id: "p4", name: "Anya", group: "child", conditions: [], outdoorWork: false },
    { id: "p5", name: "Dadi", group: "older", conditions: [], outdoorWork: false },
  ],
  home: {
    tightness: "leaky",
    purifier: false,
    cooking: "lpg",
    chimney: false,
    heating: "electric",
    incense: true,
    mosquitoCoil: false,
    smoking: false,
    burnsWaste: false,
  },
  commute: { mode: "car", km: 14, leaveAt: "08:30", returnAt: "18:30", who: ["me"] },
  schoolRun: {
    mode: "walk",
    km: 1.2,
    leaveAt: "07:30",
    returnAt: "14:00",
    who: ["p3", "p4", "p2"],
  },
  exercise: "morning",
  budget: "moderate",
  language: "en",
  scale: "IN",
  ai: true,
};

/**
 * The household as a model may see it: names removed and the place rounded
 * to the forecast grid. Settings shows exactly this.
 */
export function forModel(profile: Profile): Profile {
  return {
    ...profile,
    place: { ...profile.place, lat: coarse(profile.place.lat), lon: coarse(profile.place.lon) },
    members: profile.members.map(({ name: _name, ...rest }) => rest),
  };
}

/** A short id for a new household member, unique enough within one home. */
export function memberId(taken: readonly string[]): string {
  for (let n = taken.length + 1; ; n++) {
    const id = `p${n}`;
    if (!taken.includes(id)) return id;
  }
}

/** A copy of a profile with some home fields changed, for a what-if that varies one thing. */
export function withHome(profile: Profile, home: Partial<Profile["home"]>): Profile {
  return { ...profile, home: { ...profile.home, ...home } };
}
