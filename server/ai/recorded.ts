import { createHash } from "node:crypto";
import replies from "./recorded.json";
import type { Parsed } from "./structured";

/**
 * Real model answers for the demo's fixed day, saved by `bun run
 * evals/record.ts`. When the live model cannot answer in demo mode, one of
 * these is checked like any other answer and shown labelled as saved.
 */
const RECORDED: Readonly<Record<string, string>> = replies;

export function recorded(key: string): string | undefined {
  return RECORDED[key];
}

/** A stable key for anything that decides an answer: same inputs, same cache entry. */
export function keyOf(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("base64url");
}

type Fallback<T> = {
  /** Only the demo may fall back; a real household always gets a live answer or an error. */
  demo: boolean;
  key: string;
  /** The same check a live answer passes, so a stale recording can't slip through. */
  read: (text: string) => Parsed<T>;
};

/**
 * Asks the live model first. In the demo, a failure falls back to the answer
 * saved under `key`, if it still passes `read`; otherwise the failure stands.
 */
export async function liveOrRecorded<T>(
  live: () => Promise<{ value: T; model: string }>,
  { demo, key, read }: Fallback<T>,
  saved: (key: string) => string | undefined = recorded,
): Promise<{ value: T; model: string; recorded: boolean }> {
  try {
    const { value, model } = await live();
    return { value, model, recorded: false };
  } catch (err) {
    const text = demo ? saved(key) : undefined;
    const checked = text === undefined ? null : read(text);
    if (checked?.ok) return { value: checked.value, model: "recorded", recorded: true };
    throw err;
  }
}
