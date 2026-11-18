import { COOKING_FUELS, HEATING, type Profile, TIGHTNESS } from "@shared/profile";
import { useApp } from "../../app/state";
import { Choice, Select, Toggle } from "../../components/fields";
import type { StepProps } from "./steps";

/** How the home is built, cooked in and heated, and what burns in it. */
export function HomeStep({ draft, update }: StepProps) {
  const { t } = useApp();
  const home = draft.home;
  const set = (patch: Partial<Profile["home"]>) =>
    update({ ...draft, home: { ...home, ...patch } });
  return (
    <div className="space-y-6">
      <Choice
        legend={t("setup.tightness")}
        options={TIGHTNESS}
        value={home.tightness}
        label={(v) => t(`tightness.${v}`)}
        onChange={(tightness) => set({ tightness })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          legend={t("setup.cooking")}
          options={COOKING_FUELS}
          value={home.cooking}
          label={(v) => t(`cooking.${v}`)}
          onChange={(cooking) => set({ cooking })}
        />
        <Select
          legend={t("setup.heating")}
          options={HEATING}
          value={home.heating}
          label={(v) => t(`heating.${v}`)}
          onChange={(heating) => set({ heating })}
        />
      </div>
      <div>
        <Toggle
          label={t("setup.chimney")}
          checked={home.chimney}
          onChange={(chimney) => set({ chimney })}
        />
        <Toggle
          label={t("setup.purifier")}
          checked={home.purifier}
          onChange={(purifier) => set({ purifier })}
        />
      </div>
      <fieldset>
        <legend className="font-medium">{t("setup.habits")}</legend>
        <div className="mt-1 grid gap-x-6 sm:grid-cols-2">
          <Toggle
            label={t("setup.incense")}
            checked={home.incense}
            onChange={(incense) => set({ incense })}
          />
          <Toggle
            label={t("setup.coil")}
            checked={home.mosquitoCoil}
            onChange={(mosquitoCoil) => set({ mosquitoCoil })}
          />
          <Toggle
            label={t("setup.smoking")}
            checked={home.smoking}
            onChange={(smoking) => set({ smoking })}
          />
          <Toggle
            label={t("setup.burnsWaste")}
            checked={home.burnsWaste}
            onChange={(burnsWaste) => set({ burnsWaste })}
          />
        </div>
      </fieldset>
    </div>
  );
}
