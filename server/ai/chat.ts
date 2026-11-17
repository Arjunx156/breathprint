import type { Context } from "../../shared/actions/types";
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
