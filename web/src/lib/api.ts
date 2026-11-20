import type { AppType } from "@server/app";
import { type AirSnapshot, AirSnapshotSchema } from "@shared/air";
import { type Language, type Place, PlaceSchema } from "@shared/profile";
import { hc } from "hono/client";
import { z } from "zod/mini";

/** Typed calls to our own API; the types come straight from the server's routes. */
export const client = hc<AppType>("/");

/** A refusal from our API, carrying the code the server chose so the page can explain it. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** The part of the server's error envelope the page reads; anything else counts as the network. */
const ErrorBodySchema = z.object({ error: z.object({ code: z.string() }) });

type Reply = { ok: boolean; status: number; json(): Promise<unknown> };

/** A refused reply as an ApiError, with the server's code when it sent one. */
export async function failure(res: Omit<Reply, "ok">): Promise<ApiError> {
  const body = ErrorBodySchema.safeParse(await res.json().catch(() => null));
  return new ApiError(res.status, body.success ? body.data.error.code : "network");
}

/** A reply's body, checked against what the page expects; a refusal becomes an ApiError. */
export async function replyOf<T>(res: Reply, schema: { parse(data: unknown): T }): Promise<T> {
  if (!res.ok) throw await failure(res);
  return schema.parse(await res.json());
}

const PlacesSchema = z.object({ places: z.array(PlaceSchema) });

/** The forecast for a place, checked against the snapshot schema. */
export async function fetchAir(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<AirSnapshot> {
  const res = await client.api.air.$get(
    { query: { lat: String(lat), lon: String(lon) } },
    signal ? { init: { signal } } : {},
  );
  return replyOf(res, AirSnapshotSchema);
}

/** Places matching a name, checked against the place schema. */
export async function searchPlaces(
  q: string,
  lang: Language,
  signal?: AbortSignal,
): Promise<Place[]> {
  const res = await client.api.geocode.$get(
    { query: { q, lang } },
    signal ? { init: { signal } } : {},
  );
  return (await replyOf(res, PlacesSchema)).places;
}
