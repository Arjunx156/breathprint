import { describe, expect, test } from "bun:test";
import { defaultProfile, forModel, MEERA, memberId, ProfileSchema } from "./profile";

describe("forModel", () => {
  test("no member name reaches the model, in any field", () => {
    const sent = JSON.stringify(forModel(MEERA));
    for (const m of MEERA.members) expect(sent).not.toContain(m.name ?? "");
  });

  test("the place is rounded to the 0.1 degree forecast grid", () => {
    const precise = { ...MEERA, place: { ...MEERA.place, lat: 28.7364, lon: 77.1129 } };
    expect(forModel(precise).place).toMatchObject({ lat: 28.7, lon: 77.1 });
  });

  test("the result is still a valid profile", () => {
    expect(ProfileSchema.safeParse(forModel(MEERA)).success).toBe(true);
  });
});

describe("profiles", () => {
  test("the demo and default households validate", () => {
    expect(ProfileSchema.safeParse(MEERA).success).toBe(true);
    const place = { name: "Pune", lat: 18.5, lon: 73.9, country: "IN" };
    expect(ProfileSchema.safeParse(defaultProfile(place)).success).toBe(true);
  });

  test("a trip outside the allowed distance is rejected", () => {
    const far = { ...MEERA, commute: { ...MEERA.commute, km: 500 } };
    expect(ProfileSchema.safeParse(far).success).toBe(false);
  });

  test("new member ids never collide", () => {
    expect(memberId(["me", "p2"])).toBe("p3");
    expect(memberId(["p3", "p4"])).toBe("p5");
  });
});
