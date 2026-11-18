import { describe, expect, test } from "bun:test";
import { MEERA, type Trip } from "../profile";
import { cleanDay, severeDay, withHome } from "../testing";
import { actionById, CATALOGUE, rankActions } from "./catalogue";

const ids = (ctx: ReturnType<typeof severeDay>) => rankActions(ctx).map((c) => c.action.id);

describe("catalogue", () => {
  test("ids are unique and every action cites a source", () => {
    const all = CATALOGUE.map((a) => a.id);
    expect(new Set(all).size).toBe(all.length);
    for (const a of CATALOGUE) expect(a.sources.length).toBeGreaterThan(0);
  });

  test("looks actions up by id", () => {
    expect(actionById("diy-purifier")?.group).toBe("bedroomFilter");
    expect(actionById("nope")).toBeUndefined();
  });
});

describe("rankActions on Meera's severe day", () => {
  const ranked = rankActions(severeDay());

  test("puts a filter in the children's and Dadi's room first", () => {
    const top = ranked[0];
    expect(top?.action.id).toBe("diy-purifier");
    expect(top?.who).toEqual(["p3", "p4", "p5"]);
  });

  test("offers only the purifier she can act on", () => {
    expect(ids(severeDay())).not.toContain("purifier-night");
  });

  test("shows the metro trade-off honestly: less CO2, more of her own dose", () => {
    const metro = ranked.find((c) => c.action.id === "commute-metro");
    expect(metro?.impact.co2kg?.mid).toBeGreaterThan(1);
    expect(metro?.impact.inrPerDay?.mid).toBeGreaterThan(0);
    expect(metro?.impact.dose?.mid).toBeLessThan(0);
  });

  test("every quantified range is ordered low, mid, high", () => {
    for (const c of ranked) {
      for (const r of [c.impact.dose, c.impact.co2kg, c.impact.pm25g, c.impact.exposure]) {
        if (!r) continue;
        expect(r.low).toBeLessThanOrEqual(r.mid);
        expect(r.mid).toBeLessThanOrEqual(r.high);
      }
    }
  });

  test("every quantified action explains its method", () => {
    for (const c of ranked.filter((r) => r.action.quantified))
      expect(c.impact.method.length).toBeGreaterThan(0);
  });
});

describe("eligibility follows the household", () => {
  test("an angithi puts carbon monoxide safety first and takes sealing off the table", () => {
    const ranked = rankActions(severeDay(withHome(MEERA, { heating: "angithi" })));
    expect(ranked[0]?.action.id).toBe("heater-safety");
    expect(ranked.map((c) => c.action.id)).not.toContain("seal-gaps");
  });

  test("a family that owns a purifier is told to run it, not to build one", () => {
    const list = ids(severeDay(withHome(MEERA, { purifier: true })));
    expect(list).toContain("purifier-night");
    expect(list).not.toContain("diy-purifier");
  });

  test("a clean day asks for no indoor exercise or indoor play", () => {
    const list = ids(cleanDay());
    expect(list).not.toContain("exercise-indoors");
    expect(list).not.toContain("play-indoors");
    expect(list).not.toContain("mask-school-run");
  });
});

describe("share of the day", () => {
  test("never passes 100%, even for incense on a clean day", () => {
    const smoky = withHome(MEERA, { incense: true, mosquitoCoil: true, smoking: true });
    const rider = {
      ...smoky,
      commute: { ...(MEERA.commute as Trip), mode: "twoWheeler" as const },
    };
    for (const profile of [smoky, rider]) {
      for (const base of [12, 28, 56, 285]) {
        for (const c of rankActions(severeDay(profile, base))) {
          expect(Math.abs(c.impact.doseShare ?? 0)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
