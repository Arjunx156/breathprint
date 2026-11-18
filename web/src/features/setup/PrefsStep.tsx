import { BUDGETS, GRID_KM, LANGUAGES } from "@shared/profile";
import { useApp } from "../../app/state";
import { Choice, Toggle } from "../../components/fields";
import type { StepProps } from "./steps";

const SCALES = ["IN", "US"] as const;

/** Budget, language, AQI scale, and whether Gemini may personalise the plan. */
export function PrefsStep({ draft, update }: StepProps) {
  const { t } = useApp();
  return (
    <div className="space-y-6">
      <Choice
        legend={t("setup.budget")}
        options={BUDGETS}
        value={draft.budget}
        label={(v) => t(`budget.${v}`)}
        onChange={(budget) => update({ ...draft, budget })}
      />
      <Choice
        legend={t("setup.language")}
        options={LANGUAGES}
        value={draft.language}
        label={(v) => t(`language.${v}`)}
        onChange={(language) => update({ ...draft, language })}
      />
      <Choice
        legend={t("setup.scale")}
        options={SCALES}
        value={draft.scale}
        label={(v) => t(`scale.${v}`)}
        onChange={(scale) => update({ ...draft, scale })}
      />
      <Toggle
        label={t("setup.ai")}
        checked={draft.ai}
        onChange={(ai) => update({ ...draft, ai })}
        hint={t("ai.privacy", { km: GRID_KM })}
      />
    </div>
  );
}
