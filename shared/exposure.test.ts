import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  burstExposure,
  dailyDose,
  dose,
  homeConcentration,
  hoursAway,
  indoorConcentration,
  inhalationRate,
  legDose,
  legHours,
} from "./exposure";
import { picker } from "./factors";
import { MEERA, type Member } from "./profile";

const mid = picker("mid");
const kabir = MEERA.members.find((m) => m.name === "Kabir") as Member;
const meera = MEERA.members.find((m) => m.name === "Meera") as Member;

describe("inhalation", () => {
  test("uses the EPA Table 6-2 means, per hour", () => {
    expect(inhalationRate("child", "sleep")).toBeCloseTo(0.27, 3);
    expect(inhalationRate("adult", "moderate")).toBeCloseTo(1.62, 3);
    expect(inhalationRate("infant", "rest")).toBeCloseTo(0.186, 3);
  });

  test("dose is concentration times rate times time", () => {
    expect(dose(100, 0.5, 2)).toBe(100);
    expect(dose(-5, 0.5, 2)).toBe(0);
  });
});

describe("indoor box model", () => {
  const base = {
    outdoor: 300,
    airExchange: 1.5,
    penetration: 0.8,
    deposition: 0.2,
    cadr: 0,
    volume: 30,
    source: 0,
  };

  test("a leaky home lets in most of the outdoor air", () => {
    expect(indoorConcentration(base)).toBeCloseTo(211.8, 1);
  });

  test("a 300 m3/h purifier in a 30 m3 room cuts it by about 85%", () => {
    const filtered = indoorConcentration({ ...base, cadr: 300 });
    // 0.8 * 1.5 * 300 / (1.5 + 0.2 + 300 / 30)
    expect(filtered).toBeCloseTo(30.8, 1);
  });

  test("indoor sources add to the outdoor share", () => {
    expect(indoorConcentration({ ...base, source: 30_000 })).toBeGreaterThan(
      indoorConcentration(base),
    );
  });

  test("a burst of 35 mg in a 30 m3 room adds about 686 ug-hours per m3", () => {
    expect(burstExposure(35_000, 30, 1.5, 0.2)).toBeCloseTo(686.3, 1);
  });

  test("tighter homes keep more out", () => {
    const leaky = homeConcentration(MEERA, 300, mid);
    const tight = homeConcentration(
      { ...MEERA, home: { ...MEERA.home, tightness: "tight" } },
      300,
      mid,
    );
    expect(tight).toBeLessThan(leaky);
  });
});

describe("travel", () => {
  test("a 14 km car leg takes 42 minutes", () => {
    expect(legHours("car", 14, mid)).toBeCloseTo(0.7, 2);
    expect(legHours("none", 14, mid)).toBe(0);
  });

  test("walking breathes far more than riding in an AC car", () => {
    expect(legDose(kabir, "walk", 1.2, 300, mid)).toBeGreaterThan(
      legDose(kabir, "car", 1.2, 300, mid),
    );
  });

  test("metro legs include the walk to the station", () => {
    expect(legDose(meera, "metro", 0, 300, mid)).toBe(0);
    expect(legDose(meera, "metro", 14, 300, mid)).toBeGreaterThan(dose(300 * 0.8, 0.258, 14 / 32));
  });

  test("away hours come from the longest trip", () => {
    expect(hoursAway(MEERA, meera)).toBe(10);
    expect(hoursAway(MEERA, kabir)).toBeCloseTo(6.5, 5);
  });

  test("an ordinary day is 8 h asleep and 16 h at rest", () => {
    expect(dailyDose(meera, 100)).toBeCloseTo(100 * 0.276 * 8 + 100 * 0.258 * 16, 5);
  });
});

describe("properties", () => {
  const roomArb = fc.record({
    outdoor: fc.double({ min: 0, max: 900, noNaN: true }),
    airExchange: fc.double({ min: 0.05, max: 10, noNaN: true }),
    penetration: fc.double({ min: 0.3, max: 1, noNaN: true }),
    deposition: fc.double({ min: 0.05, max: 1, noNaN: true }),
    cadr: fc.double({ min: 0, max: 800, noNaN: true }),
    volume: fc.double({ min: 10, max: 200, noNaN: true }),
    source: fc.double({ min: 0, max: 200_000, noNaN: true }),
  });

  test("indoor PM2.5 is never negative", () => {
    fc.assert(fc.property(roomArb, (room) => indoorConcentration(room) >= 0));
  });

  test("a stronger purifier never makes the room dirtier", () => {
    fc.assert(
      fc.property(
        roomArb,
        fc.double({ min: 0, max: 500, noNaN: true }),
        (room, extra) =>
          indoorConcentration({ ...room, cadr: room.cadr + extra }) <=
          indoorConcentration(room) + 1e-9,
      ),
    );
  });

  test("without indoor sources, indoors never exceeds outdoors", () => {
    fc.assert(
      fc.property(
        roomArb,
        (room) => indoorConcentration({ ...room, source: 0 }) <= room.outdoor + 1e-9,
      ),
    );
  });
});
