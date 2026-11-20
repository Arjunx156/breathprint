/** A central estimate with the low and high ends of what the inputs allow. */
export type Range = { low: number; mid: number; high: number };

/** Which end of a factor's range to read. */
export type Bound = "low" | "mid" | "high";

/**
 * Runs a model once per parameter set and returns the spread of its results.
 * Taking min and max keeps the range honest even when an input moves the
 * output the other way.
 */
export function spread(model: (bound: Bound) => number): Range {
  const low = model("low");
  const mid = model("mid");
  const high = model("high");
  return { low: Math.min(low, mid, high), mid, high: Math.max(low, mid, high) };
}

/** A range times a factor, with low and high kept in order when the factor is negative. */
export function scale(r: Range, factor: number): Range {
  const a = r.low * factor;
  const b = r.high * factor;
  return { low: Math.min(a, b), mid: r.mid * factor, high: Math.max(a, b) };
}
