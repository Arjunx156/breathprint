/**
 * Air quality index on the two scales Breathprint shows: India's National AQI
 * (CPCB) and the US AQI (EPA, with the 2024 PM2.5 update). Both interpolate
 * linearly inside a breakpoint band and report the worst pollutant.
 */

export type Scale = "IN" | "US";
export type Pollutant = "pm25" | "pm10";

/** 0 is the cleanest band and 5 the worst, on either scale. */
export type Level = 0 | 1 | 2 | 3 | 4 | 5;

type Band = { cLow: number; cHigh: number; iLow: number; iHigh: number };

const band = (cLow: number, cHigh: number, iLow: number, iHigh: number): Band => ({
  cLow,
  cHigh,
  iLow,
  iHigh,
});

/** Breakpoints in ug/m3, 24-hour averages. */
const BREAKPOINTS: Record<Scale, Record<Pollutant, readonly Band[]>> = {
  US: {
    pm25: [
      band(0, 9.0, 0, 50),
      band(9.1, 35.4, 51, 100),
      band(35.5, 55.4, 101, 150),
      band(55.5, 125.4, 151, 200),
      band(125.5, 225.4, 201, 300),
      band(225.5, 325.4, 301, 500),
    ],
    pm10: [
      band(0, 54, 0, 50),
      band(55, 154, 51, 100),
      band(155, 254, 101, 150),
      band(255, 354, 151, 200),
      band(355, 424, 201, 300),
      band(425, 604, 301, 500),
    ],
  },
  IN: {
    pm25: [
      band(0, 30, 0, 50),
      band(31, 60, 51, 100),
      band(61, 90, 101, 200),
      band(91, 120, 201, 300),
      band(121, 250, 301, 400),
      band(251, 380, 401, 500),
    ],
    pm10: [
      band(0, 50, 0, 50),
      band(51, 100, 51, 100),
      band(101, 250, 101, 200),
      band(251, 350, 201, 300),
      band(351, 430, 301, 400),
      band(431, 510, 401, 500),
    ],
  },
};

/** Category names per scale, cleanest first; the index is the Level. */
export const CATEGORIES: Record<Scale, readonly string[]> = {
  IN: ["good", "satisfactory", "moderate", "poor", "veryPoor", "severe"],
  US: ["good", "moderate", "usg", "unhealthy", "veryUnhealthy", "hazardous"],
};

/** Readings are truncated to the reporting precision before lookup. */
function truncate(scale: Scale, pollutant: Pollutant, c: number): number {
  if (scale === "US" && pollutant === "pm25") return Math.floor(c * 10) / 10;
  return Math.floor(c);
}

/**
 * Sub-index for one pollutant. Concentrations that fall in the gap between two
 * bands (for example 9.05 on the US scale) take the upper band; readings past
 * the last band cap at 500, as both agencies do in practice.
 */
export function subIndex(scale: Scale, pollutant: Pollutant, concentration: number): number {
  const c = truncate(scale, pollutant, Math.max(0, concentration));
  const bands = BREAKPOINTS[scale][pollutant];
  const last = bands[bands.length - 1] as Band;
  if (c > last.cHigh) return 500;
  const hit = bands.find((b) => c <= b.cHigh) ?? last;
  const lo = Math.min(c, hit.cHigh);
  const value =
    ((hit.iHigh - hit.iLow) / (hit.cHigh - hit.cLow)) * (Math.max(lo, hit.cLow) - hit.cLow) +
    hit.iLow;
  return Math.round(value);
}

/** Which band an index value sits in. */
export function levelOf(index: number): Level {
  const tops = [50, 100, 150, 200, 300] as const;
  const i = tops.findIndex((top) => index <= top);
  return (i === -1 ? 5 : i) as Level;
}

/** India's scale is 100-wide above Moderate, so its bands need their own tops. */
export function levelOnScale(scale: Scale, index: number): Level {
  if (scale === "US") return levelOf(index);
  const tops = [50, 100, 200, 300, 400] as const;
  const i = tops.findIndex((top) => index <= top);
  return (i === -1 ? 5 : i) as Level;
}

export type AqiReading = {
  scale: Scale;
  value: number;
  level: Level;
  category: string;
  dominant: Pollutant;
};

/** The reported AQI: the larger of the PM2.5 and PM10 sub-indices. */
export function aqi(scale: Scale, pm25: number, pm10: number | null): AqiReading {
  const fine = subIndex(scale, "pm25", pm25);
  const coarse = pm10 === null ? -1 : subIndex(scale, "pm10", pm10);
  const value = Math.max(fine, coarse);
  const level = levelOnScale(scale, value);
  return {
    scale,
    value,
    level,
    category: CATEGORIES[scale][level] as string,
    dominant: coarse > fine ? "pm10" : "pm25",
  };
}

/**
 * Health level used by the planning rules. It always reads PM2.5 on the US
 * bands, which are stricter at the low end, so advice does not change when a
 * family switches the display scale.
 */
export function healthLevel(pm25: number): Level {
  return levelOf(subIndex("US", "pm25", pm25));
}

/**
 * EPA NowCast for PM: a weighted average of up to 12 hourly values, newest
 * first, that leans on recent hours when the air is changing fast. Needs two
 * of the three most recent hours.
 */
export function nowcast(newestFirst: readonly (number | null)[]): number | null {
  const hours = newestFirst.slice(0, 12);
  const recent = hours.slice(0, 3).filter((v) => v !== null);
  if (recent.length < 2) return null;
  const valid = hours.filter((v): v is number => v !== null);
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const weight = max === 0 ? 1 : Math.max(min / max, 0.5);
  let num = 0;
  let den = 0;
  hours.forEach((v, i) => {
    if (v === null) return;
    const w = weight ** i;
    num += w * v;
    den += w;
  });
  return Math.round((num / den) * 10) / 10;
}
