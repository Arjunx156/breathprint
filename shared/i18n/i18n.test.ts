import { describe, expect, test } from "bun:test";
import { CATALOGUE } from "../actions/catalogue";
import { today } from "../engine";
import { DayPlanSchema } from "../plan";
import { LANGUAGES, MEERA } from "../profile";
import { severeDay } from "../testing";
import { en } from "./en";
import { isMessageKey, type MessageKey, names, placeholders, t } from "./index";

const keys = Object.keys(en) as MessageKey[];

describe("messages", () => {
  test("every action has a title and how-to in every language", () => {
    for (const a of CATALOGUE) {
      expect(isMessageKey(`action.${a.id}.title`)).toBe(true);
      expect(isMessageKey(`action.${a.id}.detail`)).toBe(true);
    }
  });

  test("translations ask for the same placeholders as English", () => {
    for (const key of keys) expect(placeholders("hi", key)).toEqual(placeholders("en", key));
  });

  test("fills placeholders and leaves unknown ones visible", () => {
    expect(t("en", "reason.saves", { inr: 98 })).toBe("Saves about ₹98 a day.");
    expect(t("en", "reason.saves")).toBe("Saves about ₹{inr} a day.");
  });

  test("names people the way a parent would", () => {
    const [meera, rohan, kabir] = MEERA.members;
    expect(
      names(
        "en",
        [kabir, meera].filter((m) => m !== undefined),
        MEERA.members,
      ),
    ).toBe("Kabir and Meera");
    expect(names("en", MEERA.members, MEERA.members)).toBe("the whole family");
    expect(
      names(
        "hi",
        [rohan].filter((m) => m !== undefined),
        MEERA.members,
      ),
    ).toBe("Rohan");
    expect(
      names("en", [{ id: "x", group: "older", conditions: [], outdoorWork: false }], MEERA.members),
    ).toBe("the grandparent");
    const you = { id: "me", group: "adult", conditions: [], outdoorWork: false } as const;
    expect(names("en", [{ ...you, conditions: [] }], MEERA.members)).toBe("you");
  });
});

describe("rule plan wording", () => {
  for (const lang of LANGUAGES) {
    test(`${lang}: every reason is filled, short and grounded`, () => {
      const { plan } = today(severeDay({ ...MEERA, language: lang }));
      expect(DayPlanSchema.safeParse(plan).success).toBe(true);
      for (const s of plan.steps) {
        expect(s.reason).not.toMatch(/[{}]/);
        expect(s.reason.length).toBeLessThanOrEqual(300);
      }
    });
  }

  test("the purifier step states the dose cut and the cost", () => {
    const { plan } = today(severeDay());
    const step = plan.steps.find((s) => s.actionId === "diy-purifier");
    expect(step?.reason).toMatch(
      /^About \d+% less PM2\.5 in the day for Kabir, Anya and Dadi, roughly [\d.]+ cigarettes' worth\./,
    );
    expect(step?.reason).toContain("A one-off ₹3,500.");
  });

  test("the headline follows the day's level", () => {
    expect(today(severeDay()).plan.headline).toBe(en["headline.5"]);
  });
});
