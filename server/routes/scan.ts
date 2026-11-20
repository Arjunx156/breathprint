import { createHash } from "node:crypto";
import { LANGUAGES } from "@shared/profile";
import type { ScanReply } from "@shared/scan";
import { DAY_MS } from "@shared/time";
import { Hono } from "hono";
import { z } from "zod";
import { PROMPT_VERSION } from "../ai/prompts";
import { keyOf, liveOrRecorded } from "../ai/recorded";
import { readScan, scanRequest } from "../ai/scan";
import { structured } from "../ai/structured";
import { TtlCache } from "../cache";
import type { Llm } from "../llm/llm";
import { apiError } from "../middleware/errors";
import { valid } from "../validate";

/** The browser sends a JPEG at most 1280 px wide; a megabyte is room to spare. */
export const MAX_PHOTO_BYTES = 1024 * 1024;
const MAX_BASE64 = Math.ceil(MAX_PHOTO_BYTES / 3) * 4;

const ScanBody = z.object({
  image: z
    .string()
    .min(16)
    .max(MAX_BASE64)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "base64 only"),
  lang: z.enum(LANGUAGES),
  demo: z.boolean().default(false),
});

/** JPEG's start-of-image marker; anything else is refused before a model sees it. */
const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** A photo looks the same tomorrow, so a day is a safe time to remember what was in it. */

/** The short id saved demo replies are filed under: the photo's own hash. */
export const photoId = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 16);

/**
 * Reads one room photo. It is held only for the length of the request: never
 * written down, never logged, and only its hash is kept, to reuse the answer.
 */
export function scanRoutes({ llm }: { llm: Llm }) {
  const cache = new TtlCache<ScanReply>(DAY_MS, 200);

  return new Hono().post("/", valid("json", ScanBody), async (c) => {
    const { image, lang, demo } = c.req.valid("json");
    const bytes = Buffer.from(image, "base64");
    if (!isJpeg(bytes)) {
      return apiError(c, 415, "unsupported_media", "Send the photo as a JPEG.");
    }
    const id = photoId(bytes);
    const reply = await cache.getOrLoad(keyOf([PROMPT_VERSION, lang, id]), async () => {
      const read = readScan(lang);
      const photo = scanRequest({ mime: "image/jpeg", data: image }, lang);
      const { value, ...from } = await liveOrRecorded(() => structured(llm, photo, read), {
        demo,
        key: `scan:${lang}:${id}`,
        read,
      });
      return { scan: value, ...from };
    });
    return c.json(reply);
  });
}
