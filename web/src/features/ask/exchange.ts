import type { ChatEvent } from "@shared/replies";
import type { Turn } from "./chat";

/** One question and its answer, as it streams in and after. */
export type Exchange = {
  id: number;
  question: string;
  answer: string;
  state: "streaming" | "done" | "broken" | "offline";
  flags: string[];
  recorded: boolean;
};

export function asked(id: number, question: string): Exchange {
  return { id, question, answer: "", state: "streaming", flags: [], recorded: false };
}

/** Folds one streamed event into the exchange. */
export function step(x: Exchange, event: ChatEvent): Exchange {
  switch (event.type) {
    case "text":
      return { ...x, answer: x.answer + event.text };
    case "done":
      return { ...x, state: "done", flags: event.flags, recorded: event.recorded };
    case "error":
      return { ...x, state: "broken" };
  }
}

/** Earlier exchanges that got an answer, then the new question. */
export function history(exchanges: readonly Exchange[], question: string): Turn[] {
  const earlier = exchanges.flatMap((x): Turn[] =>
    x.answer.trim()
      ? [
          { role: "user", text: x.question },
          { role: "model", text: x.answer },
        ]
      : [],
  );
  return [...earlier, { role: "user", text: question }];
}
