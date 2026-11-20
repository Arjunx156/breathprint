import { coarse, type Language, type Place } from "@shared/profile";
import { MINUTE_MS, SECOND_MS } from "@shared/time";
import { useEffect, useState } from "react";
import { useApp } from "../../app/state";
import { TextField } from "../../components/fields";
import { searchPlaces } from "../../lib/api";

type Search =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "done"; places: Place[] }
  | { status: "error" };

const DEBOUNCE_MS = 300;
const REGION = /^[A-Z]{2}$/;

/** India's bounding box picks the India scale and rupee prices; elsewhere the browser's region does. */
function countryAt(lat: number, lon: number): string {
  if (lat >= 6.5 && lat <= 35.7 && lon >= 68 && lon <= 97.5) return "IN";
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && REGION.test(region) ? region : "US";
  } catch {
    // Older browsers lack Intl.Locale; the US scale is the default outside India.
    return "US";
  }
}

/** What the status line says about the search; nothing while idle or showing places. */
function statusKey(search: Search) {
  if (search.status === "searching") return "setup.searching";
  if (search.status === "error") return "setup.searchError";
  if (search.status === "done" && search.places.length === 0) return "setup.noResults";
  return null;
}

/** Places matching what's typed, a moment after typing stops. */
function usePlaceSearch(query: string, lang: Language): Search {
  const [search, setSearch] = useState<Search>({ status: "idle" });
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setSearch({ status: "idle" });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearch({ status: "searching" });
      searchPlaces(q, lang, controller.signal)
        .then((places) => setSearch({ status: "done", places }))
        .catch(() => {
          if (!controller.signal.aborted) setSearch({ status: "error" });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, lang]);
  return search;
}

/** Asks the browser where the household is, and rounds the answer before anyone sees it. */
function useLocate(onPlace: (place: Place) => void) {
  const { t } = useApp();
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle");
  const locate = () => {
    if (!("geolocation" in navigator)) return setLocating("failed");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // Rounded here, so the precise fix never leaves this function.
        const lat = coarse(coords.latitude);
        const lon = coarse(coords.longitude);
        onPlace({ name: t("setup.here"), lat, lon, country: countryAt(lat, lon) });
        setLocating("idle");
      },
      () => setLocating("failed"),
      { timeout: 10 * SECOND_MS, maximumAge: 10 * MINUTE_MS },
    );
  };
  return { locating, locate };
}

const samePlace = (a: Place | null, b: Place) =>
  a?.name === b.name && a.lat === b.lat && a.lon === b.lon;

type Choose = { place: Place | null; onPlace: (place: Place) => void };

/** The places a search found, the chosen one pressed. */
function Results({ search, place, onPlace }: Choose & { search: Search }) {
  if (search.status !== "done" || search.places.length === 0) return null;
  return (
    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {search.places.map((p) => (
        <li key={`${p.name}${p.lat}${p.lon}`}>
          <button
            type="button"
            className="flex min-h-12 w-full items-center px-4 text-left hover:bg-bg aria-pressed:font-semibold"
            aria-pressed={samePlace(place, p)}
            onClick={() => onPlace(p)}
          >
            {p.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PlaceStep({ place, onPlace }: Choose) {
  const { t, lang } = useApp();
  const [query, setQuery] = useState("");
  const search = usePlaceSearch(query, lang);
  const { locating, locate } = useLocate(onPlace);
  const status = statusKey(search);

  return (
    <div className="space-y-6">
      <div>
        <TextField
          label={t("setup.search")}
          hint={t("setup.searchHint")}
          type="search"
          value={query}
          onChange={setQuery}
          maxLength={80}
          autoComplete="off"
        />
        <p role="status" className="mt-2 text-sm text-muted">
          {status && t(status)}
        </p>
        <Results search={search} place={place} onPlace={onPlace} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button
          type="button"
          className="btn btn-quiet"
          onClick={locate}
          disabled={locating === "busy"}
        >
          {locating === "busy" ? t("setup.locating") : t("setup.locate")}
        </button>
        <a href="/?demo=meera" className="link min-h-11 content-center">
          {t("setup.demo")}
        </a>
      </div>
      {locating === "failed" && (
        <p role="alert" className="text-sm">
          {t("setup.locateError")}
        </p>
      )}

      <p aria-live="polite" className="text-lg">
        {place && t("setup.chosen", { place: place.name })}
      </p>
    </div>
  );
}
