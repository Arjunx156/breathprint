import { forModel, type Language, type Profile } from "@shared/profile";
import { type ChatEvent, ChatEventSchema, MAX_CHARS, MAX_MESSAGES } from "@shared/replies";
import { client, failure } from "../../lib/api";

export type Turn = { role: "user" | "model"; text: string };

/** The most recent turns that fit the API's limits, ending on the question. */
function wireTurns(turns: readonly Turn[]): Turn[] {
  return turns
    .map((turn) => ({ role: turn.role, text: turn.text.trim().slice(0, MAX_CHARS) }))
    .filter((turn) => turn.text.length > 0)
    .slice(-MAX_MESSAGES);
}

function* lines(buffer: string): Generator<ChatEvent> {
  for (const line of buffer.split("\n")) {
    if (line.trim()) yield ChatEventSchema.parse(JSON.parse(line));
  }
}

/**
 * Streams an answer as events, one per line of NDJSON. The household goes
 * as a model may see it: no names, the place rounded to the forecast grid.
 * Throws before the first event when no model answers, so the page can fall
 * back to Breathprint's own notes at once.
 */
export async function* chat(
  input: { profile: Profile; lang: Language; demo: boolean; turns: readonly Turn[] },
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await client.api.chat.$post(
    {
      json: {
        profile: forModel(input.profile),
        lang: input.lang,
        demo: input.demo,
        messages: wireTurns(input.turns),
      },
    },
    { init: { signal } },
  );
  if (!res.ok || !res.body) throw await failure(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const end = buffer.lastIndexOf("\n");
    if (end >= 0) {
      yield* lines(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
    }
    if (done) break;
  }
  yield* lines(buffer);
}
