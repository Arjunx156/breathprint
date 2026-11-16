import { type AirSnapshot, AirSnapshotSchema, type AirSummary, summarize } from "@shared/air";
import { DEMO_DAY, delhiMorning, delhiSevereSnapshot } from "@shared/fixtures";
import { coarse, type Place } from "@shared/profile";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAir } from "./api";
import { KEYS, load, save } from "./storage";

export type AirState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; summary: AirSummary; offline: boolean };

const REFRESH_MS = 5 * 60_000;

/** The current time, ticking every five minutes; frozen on the demo's morning. */
function useNow(demo: boolean): number {
  const [now, setNow] = useState(() => (demo ? delhiMorning(DEMO_DAY) : Date.now()));
  useEffect(() => {
    if (demo) return setNow(delhiMorning(DEMO_DAY));
    const id = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, [demo]);
  return now;
}

/**
 * The forecast for the household's grid cell. A fresh copy is kept on the
 * device so the plan still shows offline, labelled with when it was saved.
 */
export function useAir(place: Place | null, demo: boolean): AirState {
  const now = useNow(demo);
  const [snapshot, setSnapshot] = useState<{ data: AirSnapshot; offline: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lat = place ? coarse(place.lat) : null;
  const lon = place ? coarse(place.lon) : null;

  useEffect(() => {
    void attempt; // A retry re-runs this effect.
    if (lat === null || lon === null) return;
    if (demo) return setSnapshot({ data: delhiSevereSnapshot(DEMO_DAY), offline: false });
    const key = KEYS.air(`${lat},${lon}`);
    const controller = new AbortController();
    setSnapshot(null);
    setFailed(false);
    fetchAir(lat, lon, controller.signal)
      .then((data) => {
        save(key, data);
        setSnapshot({ data, offline: false });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        const saved = load(key, AirSnapshotSchema);
        if (saved) setSnapshot({ data: saved, offline: true });
        else setFailed(true);
      });
    return () => controller.abort();
  }, [lat, lon, demo, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const summary = useMemo(() => (snapshot ? summarize(snapshot.data, now) : null), [snapshot, now]);

  if (summary && snapshot) return { status: "ready", summary, offline: snapshot.offline };
  if (failed) return { status: "error", retry };
  return { status: "loading" };
}
