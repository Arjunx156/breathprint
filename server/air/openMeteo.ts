import { z } from "zod";
import { type AirSnapshot, AirSnapshotSchema } from "../../shared/air";
import { type AirSource, UpstreamError } from "./source";

const ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";
const TIMEOUT_MS = 8000;

const series = z.array(z.number().nullable());

const ResponseSchema = z.object({
  timezone: z.string(),
  utc_offset_seconds: z.number().int(),
  hourly: z.object({
    time: z.array(z.string()),
    pm2_5: series,
    pm10: series,
    nitrogen_dioxide: series,
    ozone: series,
  }),
});

type Response = z.infer<typeof ResponseSchema>;

/** Negative or absurd model values become gaps rather than advice. */
const clean = (v: number | null | undefined) =>
  v === null || v === undefined || v < 0 || v > 5000 ? null : Math.round(v * 10) / 10;

export function toSnapshot(lat: number, lon: number, body: Response, fetchedAt: Date): AirSnapshot {
  const h = body.hourly;
  return AirSnapshotSchema.parse({
    lat,
    lon,
    timezone: body.timezone,
    utcOffsetSeconds: body.utc_offset_seconds,
    fetchedAt: fetchedAt.toISOString(),
    source: "open-meteo",
    hours: h.time.map((time, i) => ({
      time,
      pm25: clean(h.pm2_5[i]),
      pm10: clean(h.pm10[i]),
      no2: clean(h.nitrogen_dioxide[i]),
      o3: clean(h.ozone[i]),
    })),
  });
}

/**
 * CAMS forecasts through Open-Meteo: keyless and global, about 45 km wide.
 * One day back feeds the 24-hour India AQI; three days ahead feed the plan.
 */
export function openMeteo(fetcher: typeof fetch = fetch): AirSource {
  return {
    name: "open-meteo",
    async snapshot(lat, lon, signal) {
      const url = new URL(ENDPOINT);
      url.search = new URLSearchParams({
        latitude: lat.toFixed(1),
        longitude: lon.toFixed(1),
        hourly: "pm2_5,pm10,nitrogen_dioxide,ozone",
        past_days: "1",
        forecast_days: "3",
        timezone: "auto",
      }).toString();
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const res = await fetcher(url, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { accept: "application/json" },
      }).catch((e: unknown) => {
        throw new UpstreamError("open-meteo", e instanceof Error ? e.name : "network");
      });
      if (!res.ok) throw new UpstreamError("open-meteo", `status ${res.status}`);
      const parsed = ResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new UpstreamError("open-meteo", "unexpected response shape");
      return toSnapshot(lat, lon, parsed.data, new Date());
    },
  };
}
