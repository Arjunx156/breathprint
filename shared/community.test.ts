import { describe, expect, test } from "bun:test";
import { actionById } from "./actions/catalogue";
import {
  AdvisorySchema,
  AUDIENCE_ACTIONS,
  AUDIENCES,
  basisKm,
  collective,
  templateAdvisory,
  typicalHousehold,
} from "./community";
import { cleanDay, severeDay } from "./fixtures";
import { LANGUAGES, ProfileSchema } from "./profile";

const place = { name: "Rohini, Delhi", lat: 28.7, lon: 77.1, country: "IN" };
const air = severeDay().air;

describe("community", () => {
  test("every audience's actions exist in the catalogue", () => {
    for (const a of AUDIENCES)
      for (const id of AUDIENCE_ACTIONS[a]) expect(actionById(id)).toBeDefined();
  });

  test("each typical household is a valid profile", () => {
    for (const a of AUDIENCES)
      expect(ProfileSchema.safeParse(typicalHousehold(place, a)).success).toBe(true);
  });

  test("every audience has a shared change to count on a smoggy day", () => {
    for (const a of AUDIENCES) {
      const c = collective(air, place, a, 100);
      expect(c).not.toBeNull();
      expect((c?.co2kg?.mid ?? 0) + (c?.pm25g?.mid ?? 0)).toBeGreaterThan(0);
    }
  });

  test("the figure scales with the number of households", () => {
    const one = collective(air, place, "school", 1);
    const many = collective(air, place, "school", 120);
    expect(many?.co2kg?.mid).toBeCloseTo((one?.co2kg?.mid ?? 0) * 120, 6);
  });

  test("the template advisory is a valid advisory in every language", () => {
    for (const lang of LANGUAGES)
      for (const a of AUDIENCES)
        for (const scale of ["IN", "US"] as const) {
          const parsed = AdvisorySchema.safeParse(templateAdvisory(lang, air, place, scale, a));
          expect(parsed.success).toBe(true);
        }
  });

  test("the template names today's clean window, or says there isn't one", () => {
    const severe = templateAdvisory("en", air, place, "IN", "society");
    const window = air.windows.find((w) => w.start.slice(0, 10) === air.now.slice(0, 10));
    if (window) expect(severe.situation).toContain(window.start.slice(11, 16));
    const flat = templateAdvisory("en", { ...cleanDay().air, flat: true }, place, "IN", "school");
    expect(flat.situation).toContain("no part of the day is clearly cleaner");
  });

  test("states the distance the shared figure assumes", () => {
    expect(basisKm(place, "school")).toBe(4);
    expect(basisKm(place, "workplace")).toBe(12);
    expect(basisKm(place, "society")).toBeNull();
  });
});
