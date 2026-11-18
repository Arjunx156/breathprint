import { Hono } from "hono";
import { z } from "zod";
import { AUDIENCES, CHANNELS, collective, typicalHousehold } from "../../shared/community";
import { coarse, LANGUAGES, PlaceSchema } from "../../shared/profile";
import type { AdvisoryReply } from "../../shared/replies";
import { advisoryRequest, readAdvisory } from "../ai/advisory";
import { contextFor } from "../ai/grounding";
import { PROMPT_VERSION } from "../ai/prompts";
import { keyOf, liveOrRecorded } from "../ai/recorded";
import { structured } from "../ai/structured";
import type { AirSource } from "../air/source";
import { TtlCache } from "../cache";
import type { Llm } from "../llm/llm";
import { valid } from "../validate";

const AdvisoryBody = z.object({
  lang: z.enum(LANGUAGES),
  audience: z.enum(AUDIENCES),
  channel: z.enum(CHANNELS),
  households: z.number().int().min(1).max(10_000),
  place: PlaceSchema,
  demo: z.boolean().default(false),
});

const SLOT_MS = 3 * 3_600_000;

export function advisoryRoutes({ llm, air }: { llm: Llm; air: AirSource }) {
  const cache = new TtlCache<AdvisoryReply>(SLOT_MS, 300);

  return new Hono().post("/", valid("json", AdvisoryBody), async (c) => {
    const body = c.req.valid("json");
    const { audience, channel, lang, households, demo } = body;
    const now = Date.now();
    const cell = [coarse(body.place.lat), coarse(body.place.lon)];
    const slot = demo ? "demo" : Math.floor(now / SLOT_MS);
    const key = keyOf([PROMPT_VERSION, lang, audience, channel, households, slot, cell]);

    const reply = await cache.getOrLoad(key, async (): Promise<AdvisoryReply> => {
      const ctx = await contextFor(air, typicalHousehold(body.place, audience), demo, now);
      const together = collective(ctx.air, ctx.profile.place, audience, households);
      const call = advisoryRequest(ctx, { audience, channel, lang }, together);
      const read = readAdvisory(call);
      const { value, ...from } = await liveOrRecorded(() => structured(llm, call.req, read), {
        demo,
        key: `advisory:${lang}:${audience}:${channel}`,
        read,
      });
      return { advisory: value, collective: together, ...from };
    });
    return c.json(reply);
  });
}
