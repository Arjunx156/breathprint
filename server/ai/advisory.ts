import type { Context } from "@shared/actions/types";
import {
  type Advisory,
  AdvisorySchema,
  AUDIENCE_ACTIONS,
  type Audience,
  type Channel,
  type Collective,
  SHARED_ACTION,
} from "@shared/community";
import { short } from "@shared/format";
import { tx } from "@shared/i18n";
import type { Language } from "@shared/profile";
import type { LlmRequest } from "../llm/types";
import { airFacts, numbersIn } from "./grounding";
import { advisorySystem, block } from "./prompts";
import { type Parsed, parseShaped, proseIssues, verdict } from "./structured";

const ADVISORY_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    situation: { type: "string" },
    do: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    avoid: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
    sensitive: { type: "string" },
  },
  required: ["headline", "situation", "do", "avoid", "sensitive"],
};

const AUDIENCE_NAME: Record<Audience, string> = {
  society: "a housing society",
  school: "a school",
  workplace: "a workplace",
};

/** A model request for an advisory, and what its reply is checked against. */
export type AdvisoryCall = { req: LlmRequest; allowed: number[]; lang: Language };

/** Builds the advisory request from the engine's facts, never from the client's figures. */
export function advisoryRequest(
  ctx: Context,
  input: { audience: Audience; channel: Channel; lang: Language },
  together: Collective | null,
): AdvisoryCall {
  const { audience, channel, lang } = input;
  const packet = {
    air: airFacts(ctx),
    actions: AUDIENCE_ACTIONS[audience].map((id) => ({
      id,
      title: tx(lang, `action.${id}.title`),
      how: tx(lang, `action.${id}.detail`),
    })),
    community: together && {
      households: together.households,
      sharedAction: tx("en", `action.${SHARED_ACTION[audience]}.title`),
      keptOutOfTheAirEachDay: {
        co2kg: together.co2kg ? short(together.co2kg.mid) : null,
        pm25g: together.pm25g ? short(together.pm25g.mid) : null,
      },
    },
  };
  const user = [
    block("air", packet.air),
    block("actions", packet.actions),
    block("community", packet.community),
    "Write today's advisory.",
  ].join("\n\n");
  return {
    req: {
      job: "advisory",
      system: advisorySystem(lang, AUDIENCE_NAME[audience], channel),
      turns: [{ role: "user", text: user }],
      schema: ADVISORY_JSON_SCHEMA,
      maxTokens: 1200,
      temperature: 0.5,
    },
    allowed: numbersIn(packet),
    lang,
  };
}

/** Reads a reply as an advisory, rejecting any figure not in the data or words in the wrong language. */
export function readAdvisory({
  allowed,
  lang,
}: Omit<AdvisoryCall, "req">): (reply: string) => Parsed<Advisory> {
  return (reply: string): Parsed<Advisory> => {
    const shaped = parseShaped(reply, AdvisorySchema, "advisory");
    if (!shaped.ok) return shaped;
    const advisory = shaped.value;
    const words = [
      advisory.headline,
      advisory.situation,
      ...advisory.do,
      ...advisory.avoid,
      advisory.sensitive,
    ].join("\n");
    return verdict(advisory, proseIssues(words, allowed, lang));
  };
}
