import type { Candidate } from "../actions/catalogue";
import type { Context, Impact } from "../actions/types";
import { pm25At } from "../air";
import { healthLevel } from "../aqi";
import { picker } from "../factors";
import { rupees, short, sig } from "../format";
import type { Reasoner } from "../plan";
import type { Language } from "../profile";
import { isMessageKey, type MessageKey, names, t, type Vars } from "./index";

/** Berkeley Earth: a day at 22 µg/m³ is roughly one cigarette, so 528 µg·h/m³ is one. */
export const CIGARETTE_EXPOSURE = picker("mid")("cigaretteUgM3") * 24;

const SMALLEST_CIGARETTE = 0.1;

/** Every number a sentence about this candidate may use, already rounded for reading. */
export function impactVars(lang: Language, ctx: Context, c: Candidate, time: string): Vars {
  const people = ctx.profile.members.filter((m) => c.who.includes(m.id));
  const i = c.impact;
  return {
    who: names(lang, people, ctx.profile.members),
    time,
    outside: Math.round(pm25At(ctx.air, time)),
    pct: Math.max(1, Math.round(Math.abs(i.doseShare ?? 0) * 100)),
    cig: short((i.exposure?.mid ?? 0) / CIGARETTE_EXPOSURE),
    co2: short(i.co2kg?.mid ?? 0),
    pm: short(i.pm25g?.mid ?? 0),
    inr: rupees(i.inrPerDay?.mid ?? 0),
    once: rupees(sig(i.inrOnce?.mid ?? 0)),
  };
}

function protectKey(i: Impact): MessageKey | null {
  if (!i.dose || i.dose.mid === 0) return null;
  if (i.dose.mid < 0) return "reason.protectWorse";
  return (i.exposure?.mid ?? 0) / CIGARETTE_EXPOSURE >= SMALLEST_CIGARETTE
    ? "reason.protect"
    : "reason.protectSmall";
}

function preventKey(i: Impact): MessageKey | null {
  const co2 = (i.co2kg?.mid ?? 0) >= 0.05;
  const pm = (i.pm25g?.mid ?? 0) >= 0.005;
  if (co2 && pm) return "reason.preventBoth";
  if (co2) return "reason.preventCo2";
  return pm ? "reason.preventPm" : null;
}

function moneyKeys(i: Impact): MessageKey[] {
  const keys: MessageKey[] = [];
  const daily = i.inrPerDay?.mid ?? 0;
  if (daily >= 1) keys.push("reason.saves");
  if (daily <= -1) keys.push("reason.costs");
  if ((i.inrOnce?.mid ?? 0) > 0) keys.push("reason.once");
  return keys;
}

/**
 * Explains a step from the engine's own numbers: the action's context line,
 * then what it does for the family, for the street and for the wallet.
 */
export function ruleReason(lang: Language): Reasoner {
  return (ctx, c, time) => {
    const vars = impactVars(lang, ctx, c, time);
    const why = `action.${c.action.id}.why`;
    const keys = [
      isMessageKey(why) ? why : null,
      protectKey(c.impact),
      preventKey(c.impact),
      ...moneyKeys(c.impact),
    ].filter((k): k is MessageKey => k !== null);
    return keys.map((k) => t(lang, k, vars)).join(" ");
  };
}

export function headline(lang: Language, ctx: Context): string {
  return t(lang, `headline.${healthLevel(ctx.air.today.mean)}`);
}
