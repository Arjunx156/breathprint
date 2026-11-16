import { Hono } from "hono";
import { z } from "zod";
import { coarse } from "../../shared/profile";
import type { AirSource } from "../air/source";
import { valid } from "../validate";

const CellQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** The CDN keeps a cell for 30 minutes and serves it stale for an hour while it refreshes. */
const CELL_CACHE = "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600";

export function airRoutes(source: AirSource) {
  return new Hono().get("/", valid("query", CellQuery), async (c) => {
    const { lat, lon } = c.req.valid("query");
    const cell = { lat: coarse(lat), lon: coarse(lon) };
    // Precise coordinates never reach the upstream, and every visitor in a
    // cell shares one cache entry.
    if (cell.lat !== lat || cell.lon !== lon) {
      return c.redirect(`/api/air?lat=${cell.lat}&lon=${cell.lon}`, 308);
    }
    const snapshot = await source.snapshot(cell.lat, cell.lon);
    c.header("Cache-Control", CELL_CACHE);
    return c.json(snapshot);
  });
}
