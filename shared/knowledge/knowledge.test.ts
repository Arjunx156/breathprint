import { describe, expect, test } from "bun:test";
import { actionById } from "../actions/catalogue";
import { CARDS } from "./cards";
import { cardById, search, tokenize } from "./search";

const top = (q: string) => search(q, 3).map((h) => h.card.id);

describe("cards", () => {
  test("ids are unique, every card is cited and short enough to ground a prompt", () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) {
      expect(c.sources.length).toBeGreaterThan(0);
      expect(c.body.length).toBeLessThanOrEqual(420);
    }
  });

  test("linked actions exist in the catalogue", () => {
    for (const c of CARDS) for (const id of c.actions) expect(actionById(id)).toBeDefined();
  });

  test("looks cards up by id", () => {
    expect(cardById("mask-fit")?.sources).toContain("cherrie2018");
  });
});

describe("tokenize", () => {
  test("keeps Latin and Devanagari words and drops stopwords", () => {
    expect(tokenize("Kya bacche PARK mein khel sakte hain? बच्चे")).toEqual([
      "bacche",
      "park",
      "khel",
      "sakte",
      "बच्चे",
    ]);
  });
});

describe("search", () => {
  test.each([
    ["Which mask should my son wear to school?", "mask-fit"],
    ["Can the kids go to the park this evening?", "children-play"],
    ["kya bacche park mein khel sakte hain", "children-play"],
    ["बच्चों के लिए कौन-सा मास्क", "mask-fit"],
    ["is it safe to keep the angithi on at night", "carbon-monoxide"],
    ["should I go for my morning walk", "exercise"],
    ["do snake plants clean the air", "plants"],
    ["agarbatti ka dhuan", "incense"],
    ["my daughter's asthma inhaler", "asthma"],
    ["when should I open the windows", "airing"],
    ["what is GRAP stage 4", "grap"],
    ["metro or car for office", "commute-tradeoff"],
  ])("%s finds %s", (q, id) => {
    expect(top(q)).toContain(id);
  });

  test("returns nothing for words it has never seen", () => {
    expect(search("cryptocurrency portfolio")).toEqual([]);
  });
});
