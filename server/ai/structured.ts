import type { Llm } from "../llm/llm";
import type { LlmRequest } from "../llm/types";
import { REPAIR_PROMPT } from "./prompts";

export type Parsed<T> = { ok: true; value: T } | { ok: false; issues: string[] };

/** The model answered twice and both answers broke the rules; the caller falls back. */
export class InvalidReply extends Error {
  constructor(
    readonly job: string,
    readonly issues: readonly string[],
  ) {
    super(`${job}: ${issues.length} issue(s) after repair`);
    this.name = "InvalidReply";
  }
}

/** JSON.parse that reports failure as an issue instead of throwing. */
export function parseJson(text: string): Parsed<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, issues: ["The reply was not valid JSON."] };
  }
}

/**
 * Asks for structured output, checks it with `parse`, and on failure asks
 * once more with the problems listed. A second failure throws InvalidReply.
 */
export async function structured<T>(
  llm: Llm,
  req: LlmRequest,
  parse: (text: string) => Parsed<T>,
  signal?: AbortSignal,
): Promise<{ value: T; model: string; repaired: boolean }> {
  const first = await llm.generate(req, signal);
  const checked = parse(first.text);
  if (checked.ok) return { value: checked.value, model: first.model, repaired: false };

  const retry: LlmRequest = {
    ...req,
    turns: [
      ...req.turns,
      { role: "model", text: first.text },
      { role: "user", text: REPAIR_PROMPT(checked.issues) },
    ],
  };
  const second = await llm.generate(retry, signal);
  const rechecked = parse(second.text);
  if (rechecked.ok) return { value: rechecked.value, model: second.model, repaired: true };
  console.warn(JSON.stringify({ level: "warn", llm: req.job, invalid: rechecked.issues.length }));
  throw new InvalidReply(req.job, rechecked.issues);
}
