import type { z } from "zod/mini";

/*
 * localStorage can be full, blocked or missing (private mode, old WebViews).
 * Every access is guarded so the app keeps working in memory instead.
 */

export function load<T>(key: string, schema: z.ZodMiniType<T>): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage refused: the value lives for this visit only.
  }
}

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
  air: (cell: string) => `bp.air.v1.${cell}`,
} as const;
