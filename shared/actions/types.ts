import type { AirSummary } from "../air";
import type { MessageKey } from "../i18n";
import type { Member, Profile } from "../profile";
import type { Range } from "../range";
import type { SourceId } from "../sources";

/** Protect is what the family breathes; prevent is what the household adds to the street's air. */
export type Ledger = "protect" | "prevent";
/** Where an action happens, for grouping it on the page. */
export type Category = "home" | "travel" | "activity" | "safety" | "community";
/** What an action costs to start, from nothing to a purchase. */
export type Cost = "free" | "low" | "medium" | "high";
/** When in the day an action belongs; `timeFor` turns it into a clock time. */
export type Timing =
  | "cleanWindow"
  | "morning"
  | "commute"
  | "schoolRun"
  | "afternoon"
  | "evening"
  | "cooking"
  | "night"
  | "exercise"
  | "anytime";

/** One step of "how we worked this out": a translated label, the formula, the numbers. */
export type MethodLine = { label: MessageKey; formula: string; result: string };

/** What one action changes today, each figure a range from the low and high factors. */
export type Impact = {
  /** Who the protect ledger covers. */
  people: string[];
  /** ug of PM2.5 the household avoids breathing per day; negative means more. */
  dose: Range | null;
  /** Concentration x hours avoided, summed over people, ug.h/m3. Drives the cigarette comparison. */
  exposure: Range | null;
  /** Share of the covered people's ordinary day at home that this avoids. */
  doseShare: number | null;
  /** g of PM2.5 kept out of the shared air per day. */
  pm25g: Range | null;
  /** kg of CO2 kept out per day; negative means the action adds some. */
  co2kg: Range | null;
  /** Rupees saved per day; negative is a running cost. */
  inrPerDay: Range | null;
  /** One-off spend in rupees. */
  inrOnce: Range | null;
  method: MethodLine[];
};

/** Everything an action is judged on: the household and today's air. */
export type Context = { profile: Profile; air: AirSummary };

/** One catalogue entry: when it applies, whom it covers and what it changes. */
export type ActionDef = {
  id: string;
  /** Actions in one group are alternatives: a plan takes one and offers the rest as swaps. */
  group?: string;
  ledgers: readonly Ledger[];
  category: Category;
  timing: Timing;
  cost: Cost;
  sources: readonly SourceId[];
  /** Safety actions (carbon monoxide) always lead the plan when they apply. */
  safety?: boolean;
  /** Moves someone to exert themselves outdoors; checked against the air at its time. */
  outdoorExertion?: boolean;
  /** False for advice we explain but do not put numbers on. */
  quantified: boolean;
  appliesTo: (ctx: Context) => Member[];
  eligible: (ctx: Context) => boolean;
  impact: (ctx: Context) => Impact;
};

/** The impact of advice with nothing to count. */
export const NO_IMPACT: Impact = {
  people: [],
  dose: null,
  exposure: null,
  doseShare: null,
  pm25g: null,
  co2kg: null,
  inrPerDay: null,
  inrOnce: null,
  method: [],
};
