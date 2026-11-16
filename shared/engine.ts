import { type Candidate, rankActions } from "./actions/catalogue";
import type { Context } from "./actions/types";
import { headline, ruleReason } from "./i18n/reason";
import { buildRulePlan, type DayPlan } from "./plan";
import type { Language } from "./profile";

export type Today = { ranked: Candidate[]; plan: DayPlan };

/**
 * Everything the browser shows before any model answers: every action that
 * fits this family today, ranked, and a checked plan built from them.
 */
export function today(ctx: Context, lang: Language = ctx.profile.language): Today {
  const ranked = rankActions(ctx);
  return { ranked, plan: buildRulePlan(ctx, ranked, headline(lang, ctx), ruleReason(lang)) };
}
