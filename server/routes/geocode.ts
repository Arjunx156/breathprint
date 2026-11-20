import { LANGUAGES, SEARCH_CHARS } from "@shared/profile";
import { Hono } from "hono";
import { z } from "zod";
import type { Geocoder } from "../geocode";
import { valid } from "../validate";

const SearchQuery = z.object({
  q: z.string().trim().min(SEARCH_CHARS.min).max(SEARCH_CHARS.max),
  lang: z.enum(LANGUAGES).default("en"),
});

/** GET /api/geocode: places by name, for setup. */
export function geocodeRoutes(geocode: Geocoder) {
  return new Hono().get("/", valid("query", SearchQuery), async (c) => {
    const { q, lang } = c.req.valid("query");
    const places = await geocode(q, lang);
    c.header("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return c.json({ places });
  });
}
