import { describe, expect, test } from "bun:test";
import { numbersIn } from "./grounding";
import { figures, ungrounded } from "./guard";

describe("figures", () => {
  test("picks out numbers with units or currency and ignores bare counts", () => {
    const found = figures(
      "Two children, 3 steps. PM2.5 is 323 µg/m³, 36% less, ₹3,500 once, 0.46 g, AQI of 417 and 9.7 cigarettes.",
    );
    expect(found.map((f) => f.value)).toEqual([323, 36, 3500, 0.46, 417, 9.7]);
  });

  test("reads Hindi units and Devanagari digits", () => {
    expect(figures("लगभग ३६ प्रतिशत कम, ₹४ रोज़").map((f) => f.value)).toEqual([36, 4]);
  });

  test("leaves clock times and PM2.5's own name alone", () => {
    expect(figures("Open the windows 13:00 to 16:00 when PM2.5 dips.")).toEqual([]);
  });
});

describe("ungrounded", () => {
  const allowed = [323, 36, 3500, 9.7, 417];

  test("passes figures that were given, allowing a model's light rounding", () => {
    expect(ungrounded("About 320 µg/m³ now and roughly 10 cigarettes' worth.", allowed)).toEqual(
      [],
    );
  });

  test("flags figures the model made up or worked out itself", () => {
    expect(ungrounded("This cuts exposure by 80% and saves ₹12,000 a year.", allowed)).toEqual([
      "80%",
      "₹12,000",
    ]);
  });
});

describe("numbers in the data", () => {
  test("keeps every number in an array apart, and reads grouped figures in text", () => {
    const packet = { hours: [13, 14], note: "about 1,176 g at 07:30", nested: { mid: 9.7 } };
    expect(numbersIn(packet)).toEqual([13, 14, 1176, 7, 30, 9.7]);
  });
});
