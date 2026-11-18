import { Hono } from "hono";
import { z } from "zod";
import type { PlanReply } from "../../shared/plan";
import { forModel, LANGUAGES, ProfileSchema } from "../../shared/profile";
import { contextFor } from "../ai/grounding";
import { personalPlan, plannerRequest, readPlan } from "../ai/planner";
import { PROMPT_VERSION } from "../ai/prompts";
import { keyOf, liveOrRecorded } from "../ai/recorded";
import type { AirSource } from "../air/source";
import { TtlCache } from "../cache";
import type { Llm } from "../llm/llm";
import { valid } from "../validate";

export const AiBody = z.object({
  profile: ProfileSchema,
  lang: z.enum(LANGUAGES),
  demo: z.boolean().default(false),
});

/** Forecasts move in hours, so one plan per household per three-hour slot is plenty. */
const SLOT_MS = 3 * 3_600_000;

export function planRoutes({ llm, air }: { llm: Llm; air: AirSource }) {
  const cache = new TtlCache<PlanReply>(SLOT_MS, 500);

  return new Hono().post("/", valid("json", AiBody), async (c) => {
    const { profile, lang, demo } = c.req.valid("json");
    const now = Date.now();
    const slot = demo ? "demo" : Math.floor(now / SLOT_MS);
    const key = keyOf([PROMPT_VERSION, lang, slot, forModel(profile)]);
    // Shared with anyone asking the same thing meanwhile, so one visitor
    // hanging up must not cancel it for the rest.
    const reply = await cache.getOrLoad(key, async (): Promise<PlanReply> => {
      const ctx = await contextFor(air, profile, demo, now);
      const { value, ...from } = await liveOrRecorded(() => personalPlan(llm, ctx, lang), {
        demo,
        key: `plan:${lang}`,
        read: readPlan(ctx, plannerRequest(ctx, lang)),
      });
      return { plan: value, ...from };
    });
    return c.json(reply);
  });
}
