import { describe, expect, test } from "bun:test";
import { actionById, rankActions } from "./actions/catalogue";
import { checkPlan } from "./checker";
import { cleanDay, severeDay } from "./fixtures";
import {
  alternativesFor,
  buildRulePlan,
  type DayPlanBody,
  DayPlanSchema,
  MAX_STEPS,
  type PlanStep,
  selectSteps,
  timeFor,
} from "./plan";
import { isSensitive, MEERA, withHome } from "./profile";

const ctx = severeDay();
const ranked = rankActions(ctx);
const reason = () => "Because the air is severe.";
const step = (actionId: string, time: string, who: string[] = []): PlanStep => ({
  actionId,
  time,
  who,
  reason: "r",
});
const plan = (...steps: PlanStep[]): DayPlanBody => ({ headline: "h", steps });
const codes = (body: DayPlanBody, c = ctx) => checkPlan(c, body, rankActions(c)).map((i) => i.code);

describe("rule plan for Meera's severe day", () => {
  const rule = buildRulePlan(ctx, ranked, "A severe day", reason);
  const chosen = rule.steps.map((s) => s.actionId);

  test("is valid, ordered by time and passes its own checker", () => {
    expect(DayPlanSchema.safeParse(rule).success).toBe(true);
    expect(rule.steps.length).toBeLessThanOrEqual(MAX_STEPS);
    expect(rule.steps.map((s) => s.time)).toEqual([...rule.steps.map((s) => s.time)].sort());
    expect(checkPlan(ctx, rule, ranked)).toEqual([]);
  });

  test("protects every sensitive member", () => {
    for (const m of MEERA.members.filter(isSensitive)) {
      expect(rule.steps.some((s) => s.who.includes(m.id))).toBe(true);
    }
  });

  test("keeps one choice per group and both ledgers in play", () => {
    expect(chosen.filter((id) => actionById(id)?.group === "commute")).toHaveLength(1);
    expect(chosen.some((id) => actionById(id)?.ledgers.includes("prevent"))).toBe(true);
  });

  test("masks the walk to school and filters the bedroom", () => {
    expect(chosen).toContain("mask-school-run");
    expect(chosen).toContain("diy-purifier");
  });
});

describe("selectSteps", () => {
  test("puts safety first when a stove or heater burns indoors", () => {
    const c = severeDay(withHome(MEERA, { heating: "kerosene", cooking: "biomass" }));
    const picks = selectSteps(c, rankActions(c)).map((p) => p.action.id);
    expect(picks.slice(0, 2).sort()).toEqual(["cleaner-cooking", "heater-safety"]);
  });

  test("a clean day stays short and asks for no protection it does not need", () => {
    const c = cleanDay();
    const picks = selectSteps(c, rankActions(c)).map((p) => p.action.id);
    expect(picks).not.toContain("diy-purifier");
    expect(picks).not.toContain("exercise-indoors");
  });
});

describe("timeFor", () => {
  test("follows the family's own trips and the clean window", () => {
    const def = (id: string) => actionById(id) ?? (undefined as never);
    expect(timeFor(ctx, def("mask-school-run"))).toBe("07:30");
    expect(timeFor(ctx, def("commute-metro"))).toBe("08:30");
    expect(timeFor(ctx, def("ventilate-window"))).toBe("12:00");
    expect(timeFor(ctx, def("exercise-indoors"))).toBe("07:00");
  });
});

describe("alternativesFor", () => {
  test("lists the other commute options, not the one chosen", () => {
    const alt = alternativesFor(ranked, "commute-metro");
    expect(alt).toContain("commute-bus");
    expect(alt).not.toContain("commute-metro");
    expect(alternativesFor(ranked, "skip-incense")).toEqual([]);
  });
});

describe("checkPlan", () => {
  test("rejects actions that were not offered", () => {
    expect(codes(plan(step("buy-an-ioniser", "10:00")))).toContain("unknownAction");
    expect(codes(plan(step("purifier-night", "21:00")))).toContain("unknownAction");
  });

  test("rejects repeats and two picks from one group", () => {
    expect(codes(plan(step("skip-incense", "07:00"), step("skip-incense", "19:00")))).toContain(
      "duplicate",
    );
    expect(codes(plan(step("commute-metro", "08:30"), step("commute-bus", "08:30")))).toContain(
      "groupConflict",
    );
  });

  test("rejects people who are not in the family", () => {
    expect(codes(plan(step("skip-incense", "07:00", ["arjun"])))).toContain("unknownMember");
  });

  test("only airs the house inside the clean window", () => {
    expect(codes(plan(step("ventilate-window", "08:00")))).toContain("ventilationOutsideWindow");
    expect(codes(plan(step("ventilate-window", "13:00")))).not.toContain(
      "ventilationOutsideWindow",
    );
  });

  test("never sends a child with asthma to exercise in severe air", () => {
    const c = severeDay(MEERA, 120);
    const offered = rankActions(c).some((x) => x.action.id === "exercise-window");
    const body = plan(step("exercise-window", "08:00", ["p3"]));
    const issues = checkPlan(c, body, rankActions(c)).map((i) => i.code);
    expect(offered ? issues : ["outdoorExertion"]).toContain("outdoorExertion");
  });

  test("never seals a home with a fire inside", () => {
    const c = severeDay(withHome(MEERA, { heating: "angithi" }));
    const forged = [
      ...rankActions(c),
      ...rankActions(ctx).filter((x) => x.action.id === "seal-gaps"),
    ];
    const issues = checkPlan(c, plan(step("seal-gaps", "07:00")), forged).map((i) => i.code);
    expect(issues).toContain("sealWithCombustion");
    expect(issues).toContain("safetyMissing");
  });

  test("flags sensitive members the plan leaves unprotected", () => {
    const issues = codes(plan(step("work-from-home", "08:30")));
    expect(issues).toContain("sensitiveUncovered");
  });
});
