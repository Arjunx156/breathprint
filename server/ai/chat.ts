import type { Context } from "../../shared/actions/types";
import { markers } from "../../shared/answer";
import type { Language } from "../../shared/profile";
import type { LlmRequest, Turn } from "../llm/types";
import {
  airFacts,
  cardFacts,
  householdFacts,
  numbersIn,
  optionFacts,
  optionsFor,
  outdoorCalls,
} from "./grounding";
import { block, chatSystem } from "./prompts";

const EMERGENCY: Record<string, string> = { IN: "call 112" };

/**
 * One chat turn: the rules and today's grounding in the system text, the
 * conversation as turns, the newest question fenced as data. Retrieval uses
 * the last two questions so a follow-up like "and for Dadi?" still finds cards.
 */
export function chatRequest(
  ctx: Context,
  messages: readonly Turn[],
  lang: Language,
): { req: LlmRequest; allowed: number[] } {
  const asked = messages.filter((m) => m.role === "user").map((m) => m.text);
  const options = optionsFor(ctx).slice(0, 10);
  const packet = {
    air: airFacts(ctx),
    household: householdFacts(ctx.profile),
    actions: optionFacts(ctx, options).map(({ id, title, effect, suggestedTime, covers }) => ({
      id,
      title,
      effect,
      suggestedTime,
      covers,
    })),
    cards: cardFacts(asked.slice(-2).join(" "), options),
  };
  const emergency = EMERGENCY[ctx.profile.place.country] ?? "call the local emergency number";
  const calls = new Set(Object.values(outdoorCalls(ctx)).map((call) => call.kind));
  const system = [
    chatSystem(lang, emergency, calls),
    block("air", packet.air),
    block("household", packet.household),
    block("actions", packet.actions),
    block("cards", packet.cards),
  ].join("\n\n");
  const turns = messages.map((m, i) =>
    i === messages.length - 1 ? { role: m.role, text: block("question", m.text) } : m,
  );
  return {
    req: { job: "chat", system, turns, maxTokens: 700, temperature: 0.3 },
    allowed: numbersIn(packet),
  };
}

/** The step to offer in place of an outing, by the card an answer about it cites. */
const INDOOR_STEP: Record<string, string> = {
  exercise: "exercise-indoors",
  "children-play": "play-indoors",
};

/**
 * On an indoor day an answer about exercise or play should end on something
 * to do instead. A small model sometimes leaves that out, so when the answer
 * cites the topic's card but offers no indoor step, the engine adds its own,
 * as a marker the page shows as a step. Empty when nothing needs adding.
 */
export function indoorStep(ctx: Context, text: string): string {
  if (!Object.values(outdoorCalls(ctx)).some((call) => call.kind === "indoors")) return "";
  const cited = markers(text);
  const steps = Object.values(INDOOR_STEP);
  if (cited.actions.some((id) => steps.includes(id))) return "";
  const offered = new Set(optionsFor(ctx).map((c) => c.action.id));
  const step = cited.cards.map((id) => INDOOR_STEP[id]).find((id) => id && offered.has(id));
  return step ? ` [A:${step}]` : "";
}
