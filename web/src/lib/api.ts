import type { AppType } from "@server/app";
import { type AirSnapshot, AirSnapshotSchema } from "@shared/air";
import type { Language, Place } from "@shared/profile";
import { hc } from "hono/client";

/** Typed calls to our own API; the types come straight from the server's routes. */
export const client = hc<AppType>("/");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

async function failure(res: { status: number; json(): Promise<unknown> }): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  return new ApiError(res.status, body?.error?.code ?? "network");
}

export async function fetchAir(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<AirSnapshot> {
  const res = await client.api.air.$get(
    { query: { lat: String(lat), lon: String(lon) } },
    signal ? { init: { signal } } : {},
  );
  if (!res.ok) throw await failure(res);
  return AirSnapshotSchema.parse(await res.json());
}

export async function searchPlaces(
  q: string,
  lang: Language,
  signal?: AbortSignal,
): Promise<Place[]> {
  const res = await client.api.geocode.$get(
    { query: { q, lang } },
    signal ? { init: { signal } } : {},
  );
  if (!res.ok) throw await failure(res);
  return (await res.json()).places;
}
