import { describe, expect, test } from "bun:test";
import { defaultProfile, MEERA } from "./profile";
import {
  homeAfter,
  homeChanges,
  type Scan,
  ScanSchema,
  scanFixes,
  sightingsOf,
  withSightings,
} from "./scan";
import { severeDay, withHome } from "./testing";

const scan = (room: Scan["room"], ...kinds: Scan["sightings"][number]["kind"][]): Scan => ({
  room,
  sightings: kinds.map((kind) => ({ kind, where: "on the shelf" })),
});

const ids = (c: { action: { id: string } }[]) => c.map((x) => x.action.id);

describe("room scan", () => {
  test("reads each kind once and nothing from a photo that isn't a room", () => {
    expect(sightingsOf(scan("kitchen", "incense", "incense", "stove-no-chimney"))).toEqual([
      "incense",
      "stove-no-chimney",
    ]);
    expect(sightingsOf(scan("notRoom", "incense"))).toEqual([]);
  });

  test("turns sightings into the household's own answers", () => {
    const home = defaultProfile(MEERA.place).home;
    const after = homeAfter(home, ["incense", "angithi", "window-gaps"]);
    expect(after).toMatchObject({ incense: true, heating: "angithi", tightness: "leaky" });
    expect(homeChanges(home, ["incense"])).toEqual([{ field: "incense", from: false, to: true }]);
    expect(homeChanges(home, ["open-window", "dry-sweeping"])).toEqual([]);
  });

  test("a chimney seen anywhere in the photo outweighs a stove that looks bare", () => {
    const home = withHome(defaultProfile(MEERA.place), { chimney: false }).home;
    expect(homeAfter(home, ["stove-no-chimney", "chimney"]).chimney).toBe(true);
  });

  test("ranks the fixes on the home the photo shows, safety first", () => {
    const ctx = severeDay(withHome(MEERA, { incense: false, heating: "electric" }));
    const fixes = ids(scanFixes(ctx, ["incense", "angithi", "stove-no-chimney"]));
    expect(fixes[0]).toBe("heater-safety");
    expect(fixes).toContain("skip-incense");
    expect(fixes).toContain("cooking-vent");
    // An angithi means no sealing: carbon monoxide needs the gaps.
    expect(ids(scanFixes(ctx, ["angithi", "window-gaps"]))).not.toContain("seal-gaps");
  });

  test("offers nothing for a room with nothing to fix", () => {
    expect(scanFixes(severeDay(), ["chimney"])).toEqual([]);
    expect(scanFixes(severeDay(), [])).toEqual([]);
  });

  test("a saved scan changes only the home", () => {
    const next = withSightings(MEERA, ["mosquito-coil"]);
    expect(next.home.mosquitoCoil).toBe(true);
    expect({ ...next, home: MEERA.home }).toEqual(MEERA);
  });

  test("accepts only the closed list and short notes", () => {
    expect(ScanSchema.safeParse(scan("kitchen", "incense")).success).toBe(true);
    const bad = { room: "kitchen", sightings: [{ kind: "candle", where: "table" }] };
    expect(ScanSchema.safeParse(bad).success).toBe(false);
    const long = { room: "kitchen", sightings: [{ kind: "incense", where: "x".repeat(91) }] };
    expect(ScanSchema.safeParse(long).success).toBe(false);
  });
});
