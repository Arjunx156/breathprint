import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { type Bound, scale, spread } from "./range";

const ordered = ({ low, mid, high }: { low: number; mid: number; high: number }) =>
  low <= mid && mid <= high;

describe("range", () => {
  test("spread keeps low below high when an input pulls the result the other way", () => {
    // A higher parameter set that lowers the result, like a better purifier lowering indoor PM.
    const inverse: Record<Bound, number> = { low: 30, mid: 20, high: 10 };
    expect(spread((b) => inverse[b])).toEqual({ low: 10, mid: 20, high: 30 });
  });

  test("spread never drops the central estimate", () => {
    expect(spread((b) => ({ low: 5, mid: 1, high: 3 })[b]).mid).toBe(1);
  });

  test("scaling by a negative factor, such as a saving, keeps the range ordered", () => {
    expect(scale({ low: 1, mid: 2, high: 4 }, -10)).toEqual({ low: -40, mid: -20, high: -10 });
  });

  test("any ordered range stays ordered under any finite factor", () => {
    const finite = fc.double({ min: -1e6, max: 1e6, noNaN: true });
    fc.assert(
      fc.property(fc.tuple(finite, finite, finite), finite, (xs, factor) => {
        const [low, mid, high] = [...xs].sort((a, b) => a - b) as [number, number, number];
        return ordered(scale({ low, mid, high }, factor));
      }),
    );
  });
});
