import type { AirSummary } from "@shared/air";
import {
  type Advisory,
  type Audience,
  type Channel,
  type Collective,
  collective,
  templateAdvisory,
} from "@shared/community";
import { short } from "@shared/format";
import { t as translate } from "@shared/i18n";
import { coarse, type Language, type Profile } from "@shared/profile";
import { type AdvisoryReply, AdvisoryReplySchema } from "@shared/replies";
import { client, replyOf } from "../../lib/api";

/** What the advisory form asks for. */
export type Inputs = { audience: Audience; channel: Channel; households: number; lang: Language };
/** An advisory ready to show, and who wrote it. */
export type Written = Inputs & {
  advisory: Advisory;
  collective: Collective | null;
  /** Gemini, a saved demo reply, Breathprint's own after Gemini failed, or the live draft. */
  by: "model" | "recorded" | "fallback" | "template";
};

/** The most households the form accepts. */
export const MAX_HOUSEHOLDS = 10_000;

/** Sends only the area, rounded to the forecast grid; no household goes with it. */
export async function fetchAdvisory(
  input: Inputs & { place: Profile["place"]; demo: boolean },
  signal: AbortSignal,
): Promise<AdvisoryReply> {
  const place = { ...input.place, lat: coarse(input.place.lat), lon: coarse(input.place.lon) };
  const res = await client.api.advisory.$post({ json: { ...input, place } }, { init: { signal } });
  return replyOf(res, AdvisoryReplySchema);
}

/** A whole number of households in range, or null for anything else typed. */
export function householdsOf(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_HOUSEHOLDS ? n : null;
}

/** Breathprint's own advisory for what the form asks, ready before anyone presses Write. */
export function draftOf(
  ask: Omit<Inputs, "households"> & { households: number | null },
  summary: AirSummary,
  profile: Profile,
): Written {
  const { audience, lang, households } = ask;
  return {
    ...ask,
    households: households ?? 1,
    advisory: templateAdvisory(lang, summary, profile.place, profile.scale, audience),
    collective:
      households === null ? null : collective(summary, profile.place, audience, households),
    by: "template",
  };
}

/** Whether a written advisory still answers what the form asks for. */
export const sameInputs = (a: Inputs, b: Inputs) =>
  a.audience === b.audience &&
  a.channel === b.channel &&
  a.households === b.households &&
  a.lang === b.lang;

/** What the households keep out of the shared air together, in whichever figures exist. */
export function togetherLine(lang: Language, c: Collective, audience: Audience): string | null {
  const vars = {
    n: c.households.toLocaleString("en-IN"),
    how: translate(lang, `community.how.${audience}`),
  };
  if (c.co2kg && c.pm25g)
    return translate(lang, "community.together", {
      ...vars,
      co2: short(c.co2kg.mid),
      pm: short(c.pm25g.mid),
    });
  if (c.co2kg)
    return translate(lang, "community.togetherCo2", { ...vars, co2: short(c.co2kg.mid) });
  if (c.pm25g) return translate(lang, "community.togetherPm", { ...vars, pm: short(c.pm25g.mid) });
  return null;
}

/** The advisory as plain text, laid out to survive a paste into WhatsApp or an email. */
export function plainText(written: Written, together: string | null, source: string): string {
  const say = (key: "community.do" | "community.avoid" | "community.sensitive") =>
    translate(written.lang, key);
  const { advisory } = written;
  return [
    advisory.headline,
    "",
    advisory.situation,
    "",
    `${say("community.do")}:`,
    ...advisory.do.map((line) => `- ${line}`),
    "",
    `${say("community.avoid")}:`,
    ...advisory.avoid.map((line) => `- ${line}`),
    "",
    `${say("community.sensitive")}: ${advisory.sensitive}`,
    ...(together ? ["", together] : []),
    "",
    source,
  ].join("\n");
}
