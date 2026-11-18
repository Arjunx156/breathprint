import { describe, expect, test } from "bun:test";
import { percent, totals } from "./coverage";

const LCOV = `TN:
SF:shared\\aqi.ts
FNF:4
FNH:4
LF:50
LH:49
end_of_record
TN:
SF:web/src/app/App.tsx
FNF:6
FNH:3
LF:40
LH:20
end_of_record
`;

describe("coverage totals", () => {
  test("sums every file, whichever slash the path uses", () => {
    expect(totals(LCOV, "")).toEqual({ lines: [69, 90], functions: [7, 10] });
  });

  test("keeps to the files under a prefix", () => {
    expect(totals(LCOV, "shared/")).toEqual({ lines: [49, 50], functions: [4, 4] });
  });

  test("a part with nothing to cover counts as covered", () => {
    expect(percent([0, 0])).toBe(100);
    expect(percent([49, 50])).toBe(98);
  });
});
