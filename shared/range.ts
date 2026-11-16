/** A central estimate with the low and high ends of what the inputs allow. */
export type Range = { low: number; mid: number; high: number };

export type Bound = "low" | "mid" | "high";

export const BOUNDS: readonly Bound[] = ["low", "mid", "high"];

export function range(low: number, mid: number, high: number): Range {
  return { low, mid, high };
}

export function point(value: number): Range {
  return { low: value, mid: value, high: value };
}

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

export function scale(r: Range, factor: number): Range {
  const a = r.low * factor;
  const b = r.high * factor;
  return { low: Math.min(a, b), mid: r.mid * factor, high: Math.max(a, b) };
}

export function add(a: Range, b: Range): Range {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

export function sum(ranges: readonly Range[]): Range {
  return ranges.reduce(add, point(0));
}

export function isZero(r: Range): boolean {
  return r.low === 0 && r.mid === 0 && r.high === 0;
}
