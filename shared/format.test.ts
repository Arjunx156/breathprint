import { describe, expect, test } from "bun:test";
import { rupees, short, sig } from "./format";

describe("format", () => {
  test("sig keeps two significant figures", () => {
    expect(sig(3412)).toBe(3400);
    expect(sig(0.0734)).toBe(0.073);
    expect(sig(0)).toBe(0);
  });

  test("short drops decimals once a number is big enough to read whole", () => {
    expect(short(12.6)).toBe("13");
    expect(short(4.25)).toBe("4.3");
    expect(short(0.0461)).toBe("0.046");
  });

  test("rupees are whole, unsigned and grouped in lakhs", () => {
    expect(rupees(163.4)).toBe("163");
    expect(rupees(3500)).toBe("3,500");
    expect(rupees(-60)).toBe("60");
    expect(rupees(120000)).toBe("1,20,000");
  });
});
