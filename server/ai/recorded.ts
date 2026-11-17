import { createHash } from "node:crypto";
import replies from "./recorded.json";

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
