import { describe, expect, test } from "bun:test";
import { summarize } from "@shared/air";
import type { Collective } from "@shared/community";
import { DEMO_DAY, delhiMorning, delhiSevereSnapshot } from "@shared/fixtures";
import { MEERA } from "@shared/profile";
import {
  draftOf,
  householdsOf,
  type Inputs,
  plainText,
  sameInputs,
  togetherLine,
  type Written,
} from "./advisory";

const range = (mid: number) => ({ low: mid / 2, mid, high: mid * 2 });
const together = (co2: number | null, pm: number | null): Collective => ({
  actionId: "no-waste-burning",
  households: 1200,
  co2kg: co2 === null ? null : range(co2),
  pm25g: pm === null ? null : range(pm),
});

describe("community advisory", () => {
  test("takes only a whole number of households in range", () => {
    expect(householdsOf("120")).toBe(120);
    for (const raw of ["0", "-3", "2.5", "", "abc", "10001"]) expect(householdsOf(raw)).toBeNull();
  });

  test("keeps a written advisory only while the form still asks for it", () => {
    const asked: Inputs = { audience: "society", channel: "whatsapp", households: 120, lang: "en" };
    expect(sameInputs(asked, { ...asked })).toBe(true);
    expect(sameInputs(asked, { ...asked, lang: "hi" })).toBe(false);
    expect(sameInputs(asked, { ...asked, households: 121 })).toBe(false);
  });

  test("drafts its own advisory, counting the households only once the count is valid", () => {
    const summary = summarize(delhiSevereSnapshot(DEMO_DAY), delhiMorning(DEMO_DAY));
    const ask = { audience: "society", channel: "whatsapp", lang: "en" } as const;
    const counted = draftOf({ ...ask, households: 120 }, summary, MEERA);
    expect(counted).toMatchObject({ ...ask, households: 120, by: "template" });
    expect(counted.advisory.headline).not.toBe("");
    expect(counted.collective?.households).toBe(120);

    const uncounted = draftOf({ ...ask, households: null }, summary, MEERA);
    expect(uncounted.households).toBe(1);
    expect(uncounted.collective).toBeNull();
  });

  test("says what households keep out of the air, in whichever figures exist", () => {
    expect(togetherLine("en", together(42, 3.5), "society")).toBe(
      "If 1,200 households stop burning leaves and rubbish, about 42 kg of CO2 and 3.5 g of PM2.5 stay out of the air we share each day.",
    );
    expect(togetherLine("en", together(42, null), "society")).toContain("about 42 kg of CO2");
    expect(togetherLine("en", together(null, 3.5), "society")).toContain("about 3.5 g of PM2.5");
    expect(togetherLine("en", together(null, null), "society")).toBeNull();
  });

  test("lays the advisory out as plain text for a paste", () => {
    const written: Written = {
      audience: "society",
      channel: "whatsapp",
      households: 120,
      lang: "en",
      collective: null,
      by: "template",
      advisory: {
        headline: "Severe air today",
        situation: "AQI 417.",
        do: ["Mask up", "Shut windows"],
        avoid: ["Burning waste"],
        sensitive: "Stay in.",
      },
    };
    expect(plainText(written, null, "Source: CAMS")).toBe(
      [
        "Severe air today",
        "",
        "AQI 417.",
        "",
        "Do:",
        "- Mask up",
        "- Shut windows",
        "",
        "Avoid:",
        "- Burning waste",
        "",
        "If you are more at risk: Stay in.",
        "",
        "Source: CAMS",
      ].join("\n"),
    );
  });
});
