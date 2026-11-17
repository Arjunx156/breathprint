import type { Context } from "../../shared/actions/types";
import {
  type Advisory,
  AdvisorySchema,
  AUDIENCE_ACTIONS,
  type Audience,
  type Channel,
  type Collective,
  SHARED_ACTION,
} from "../../shared/community";
import { short } from "../../shared/format";
import { isMessageKey, t } from "../../shared/i18n";
import type { Language } from "../../shared/profile";
import type { LlmRequest } from "../llm/types";
import { airFacts, numbersIn } from "./grounding";
import { ungrounded } from "./guard";
import { advisorySystem, block } from "./prompts";
import { type Parsed, parseJson } from "./structured";

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

const text = (lang: Language, key: string) => (isMessageKey(key) ? t(lang, key) : key);

export function advisoryRequest(
  ctx: Context,
  input: { audience: Audience; channel: Channel; lang: Language },
  together: Collective | null,
): { req: LlmRequest; allowed: number[] } {
  const { audience, channel, lang } = input;
  const packet = {
    air: airFacts(ctx),
    actions: AUDIENCE_ACTIONS[audience].map((id) => ({
      id,
      title: text(lang, `action.${id}.title`),
      how: text(lang, `action.${id}.detail`),
    })),
    community: together && {
      households: together.households,
      sharedAction: text("en", `action.${SHARED_ACTION[audience]}.title`),
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
  };
}

export function readAdvisory(allowed: readonly number[]) {
  return (reply: string): Parsed<Advisory> => {
    const json = parseJson(reply);
    if (!json.ok) return json;
    const shaped = AdvisorySchema.safeParse(json.value);
    if (!shaped.success) {
      return {
        ok: false,
        issues: shaped.error.issues.map((i) => `${i.path.join(".") || "advisory"}: ${i.message}`),
      };
    }
    const a = shaped.data;
    const words = [a.headline, a.situation, ...a.do, ...a.avoid, a.sensitive].join("\n");
    const issues = ungrounded(words, allowed).map(
      (f) => `"${f}" is not in the data; use only figures written there.`,
    );
    return issues.length > 0 ? { ok: false, issues } : { ok: true, value: a };
  };
}
