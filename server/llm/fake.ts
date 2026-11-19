import { createLlm, type Llm, SILENT } from "./llm";
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

/** A script that gives `replies` in turn, then fails, keeping every request in `seen`. */
export function inTurn(replies: Array<string | Error>, seen: LlmRequest[] = []): Script {
  return (req) => {
    seen.push(req);
    return replies.shift() ?? new Error("no more replies");
  };
}

/** A whole model client on a script: silent, instant, and on the models given. */
export function scriptedLlm(script: Script, models: readonly string[] = ["m1"]): Llm {
  return createLlm({ provider: scripted(script), models, timeoutMs: 5000, ...SILENT });
}
