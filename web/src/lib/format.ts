import type { Language } from "@shared/profile";

const locale = (lang: Language) => (lang === "hi" ? "hi-IN" : "en-IN");

/*
 * Forecast hours are already local to the place, so they are formatted as if
 * they were UTC; that keeps the viewer's own time zone out of it.
 */
const asUtc = (localHour: string) => new Date(`${localHour.slice(0, 13)}:00:00Z`);

/** "Wednesday 18 November" for a forecast's local hour. */
export function localDay(localHour: string, lang: Language): string {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(asUtc(localHour));
}

/** "Wed" for a forecast's local hour. */
export function weekdayShort(localHour: string, lang: Language): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: "short", timeZone: "UTC" }).format(
    asUtc(localHour),
  );
}

/** "08:30" in the place's own time zone, for an ISO instant. */
export function clockIn(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  } catch {
    // An unknown zone name from upstream: the viewer's own clock is close enough.
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(iso),
    );
  }
}
