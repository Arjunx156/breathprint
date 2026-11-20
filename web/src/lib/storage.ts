import type { z } from "zod/mini";

/*
 * localStorage can be full, blocked or missing (private mode, old WebViews).
 * Every access is guarded so the app keeps working in memory instead.
 */

/** The value saved under `key`, or null when there is none or it no longer fits `schema`. */
export function load<T>(key: string, schema: z.ZodMiniType<T>): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    // Storage blocked, or the value isn't JSON: start from nothing.
    return null;
  }
}

/** Saves `value` as JSON under `key`. */
export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage refused: the value lives for this visit only.
  }
}

/** Forgets whatever is saved under `key`. */
export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored, nothing to remove.
  }
}

export const KEYS = {
  profile: "bp.profile.v1",
  done: "bp.done.v1",
  aiPlan: "bp.aiplan.v1",
  air: (cell: string) => `bp.air.v1.${cell}`,
} as const;
