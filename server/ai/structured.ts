import { inScript } from "@shared/i18n/script";
import type { Language } from "@shared/profile";
import { issueLines, type SchemaIssue } from "../issues";
import type { Llm } from "../llm/llm";
import type { LlmRequest } from "../llm/types";
import { logger } from "../log";
import { ungrounded } from "./guard";
import { REPAIR_PROMPT, wrongLanguage } from "./prompts";

/** A reply that passed its checks, or the issues to send back. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; issues: readonly string[] };

/** Anything with zod's safeParse, from zod or zod/mini. */
type Schema<T> = {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: readonly SchemaIssue[] } };
};

/** The model answered twice and both answers broke the rules; the caller falls back. */
export class InvalidReply extends Error {
  readonly job: string;
  readonly issues: readonly string[];

  constructor(job: string, issues: readonly string[]) {
    super(`${job}: ${issues.length} issue(s) after repair`);
    this.name = "InvalidReply";
    this.job = job;
    this.issues = issues;
  }
}

/** JSON.parse that reports failure as an issue instead of throwing. */
function parseJson(text: string): Parsed<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, issues: ["The reply was not valid JSON."] };
  }
}

/** A reply read as JSON and checked against `schema`; each issue names its field, or `whole`. */
export function parseShaped<T>(text: string, schema: Schema<T>, whole: string): Parsed<T> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const shaped = schema.safeParse(json.value);
  if (shaped.success) return { ok: true, value: shaped.data };
  return { ok: false, issues: issueLines(shaped.error.issues, whole) };
}

/** The value when nothing is wrong with it; otherwise every issue, to send back for a repair. */
export function verdict<T>(value: T, issues: readonly string[]): Parsed<T> {
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

/** Prose that only quotes figures from the data, written in the reader's own script. */
export function proseIssues(words: string, allowed: readonly number[], lang: Language): string[] {
  const issues = ungrounded(words, allowed).map(
    (figure) => `"${figure}" is not in the data; use only figures written there.`,
  );
  if (!inScript(words, lang)) issues.push(wrongLanguage(lang));
  return issues;
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
  logger.warn({ llm: req.job, invalid: rechecked.issues.length });
  throw new InvalidReply(req.job, rechecked.issues);
}
