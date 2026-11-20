import {
  AUDIENCES,
  type Audience,
  CHANNELS,
  type Channel,
  MAX_HOUSEHOLDS,
} from "@shared/community";
import { GRID_KM, LANGUAGES, type Language } from "@shared/profile";
import type { SubmitEvent } from "react";
import { useApp } from "../../app/state";
import { Choice, TextField } from "../../components/fields";

/** What the form holds; households stay as typed until they're checked. */
export type Form = { audience: Audience; channel: Channel; rawHouseholds: string; lang: Language };

type Props = {
  form: Form;
  invalid: boolean;
  writing: boolean;
  onChange: (patch: Partial<Form>) => void;
  onSubmit: (e: SubmitEvent) => void;
};

/** Who the advisory is for, how it travels, and in which language. */
export function AdvisoryForm({ form, invalid, writing, onChange, onSubmit }: Props) {
  const { t } = useApp();
  return (
    <form onSubmit={onSubmit} className="space-y-7 print:hidden" noValidate>
      <Choice
        legend={t("community.audience")}
        options={AUDIENCES}
        value={form.audience}
        label={(v) => t(`audience.${v}`)}
        onChange={(audience) => onChange({ audience })}
      />
      <TextField
        label={t("community.households")}
        hint={t("community.householdsHint")}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_HOUSEHOLDS}
        step={1}
        value={form.rawHouseholds}
        onChange={(rawHouseholds) => onChange({ rawHouseholds })}
        error={invalid ? t("community.householdsInvalid") : null}
      />
      <Choice
        legend={t("community.channel")}
        options={CHANNELS}
        value={form.channel}
        label={(v) => t(`channel.${v}`)}
        onChange={(channel) => onChange({ channel })}
      />
      <Choice
        legend={t("community.language")}
        options={LANGUAGES}
        value={form.lang}
        label={(v) => t(`language.${v}`)}
        onChange={(lang) => onChange({ lang })}
      />
      <div className="border-t border-line pt-6">
        <button type="submit" className="btn btn-primary" disabled={writing}>
          {t("community.submit")}
        </button>
        <p className="mt-3 text-sm text-muted">{t("community.privacy", { km: GRID_KM })}</p>
      </div>
    </form>
  );
}
