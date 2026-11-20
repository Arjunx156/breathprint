/** Durations in milliseconds, so a timeout or a cache life reads in its own units. */
export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const HOURS_PER_DAY = 24;

/** Forecasts move in hours, so plans and advisories are kept per three-hour slot, on both sides. */
export const SLOT_MS = 3 * HOUR_MS;

/** The slot an instant falls in, so the browser and the server agree on which plan is current. */
export const slotOf = (nowMs: number) => Math.floor(nowMs / SLOT_MS);
