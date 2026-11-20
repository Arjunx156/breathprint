import { type PlanReply, PlanReplySchema } from "@shared/plan";
import { forModel, type Language, type Profile } from "@shared/profile";
import { slotOf } from "@shared/time";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod/mini";
import { client, replyOf } from "../../lib/api";
import { KEYS, load, save } from "../../lib/storage";

export type PersonalPlan =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ready"; key: string; reply: PlanReply }
  | { status: "failed"; retry: () => void };

const SavedSchema = z.object({ key: z.string(), reply: PlanReplySchema });

/** Replies fetched during this visit, so moving between pages never asks twice. */
const fetched = new Map<string, PlanReply>();

function fnv1a(text: string): string {
  let h = 0x81_1c_9d_c5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01_00_01_93);
  }
  return (h >>> 0).toString(36);
}

function planKey(profile: Profile, lang: Language, demo: boolean, now: number): string {
  // The display scale and the consent flag don't change which plan fits.
  const { scale: _scale, ai: _ai, ...household } = forModel(profile);
  return fnv1a(JSON.stringify([household, lang, demo ? "demo" : slotOf(now)]));
}

/** Sends the household as a model may see it: no names, the place rounded to the grid. */
async function fetchPlan(
  profile: Profile,
  lang: Language,
  demo: boolean,
  signal: AbortSignal,
): Promise<PlanReply> {
  const res = await client.api.plan.$post(
    { json: { profile: forModel(profile), lang, demo } },
    { init: { signal } },
  );
  return replyOf(res, PlanReplySchema);
}

function remembered(key: string, demo: boolean): PlanReply | null {
  const hit = fetched.get(key);
  if (hit || demo) return hit ?? null;
  const saved = load(KEYS.aiPlan, SavedSchema);
  return saved?.key === key ? saved.reply : null;
}

/**
 * Gemini's plan for this household, fetched once the family has agreed to
 * it. The rules plan is already on screen, so this only ever adds an option.
 */
export function usePersonalPlan(profile: Profile, lang: Language, demo: boolean): PersonalPlan {
  const key = useMemo(() => planKey(profile, lang, demo, Date.now()), [profile, lang, demo]);
  const [state, setState] = useState<PersonalPlan>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    void attempt; // A retry re-runs this effect.
    if (!profile.ai) return;
    const hit = remembered(key, demo);
    if (hit) return setState({ status: "ready", key, reply: hit });
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchPlan(profile, lang, demo, controller.signal)
      .then((reply) => {
        fetched.set(key, reply);
        if (!demo) save(KEYS.aiPlan, { key, reply });
        setState({ status: "ready", key, reply });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "failed", retry });
      });
    return () => controller.abort();
  }, [key, profile, lang, demo, attempt, retry]);

  return profile.ai ? state : { status: "off" };
}
