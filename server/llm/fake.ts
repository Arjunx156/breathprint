import type { LlmRequest, Provider } from "./types";

/** What the fake says to a request: some text, or an error to throw. */
export type Script = (req: LlmRequest, model: string) => string | Error;

/**
 * A provider that answers from a script, for tests and evals replayed from
 * recordings. It streams in small pieces so stream handling is exercised too.
 */
export function scripted(script: Script): Provider {
  const answer = (req: LlmRequest, model: string) => {
    const reply = script(req, model);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return {
    name: "fake",
    async generate(model, req) {
      return { text: answer(req, model), usage: { input: 0, output: 0 } };
    },
    async *stream(model, req) {
      const text = answer(req, model);
      for (let i = 0; i < text.length; i += 24) yield { text: text.slice(i, i + 24) };
      yield { text: "", usage: { input: 0, output: 0 } };
    },
  };
}
