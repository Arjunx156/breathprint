import { SIGHTINGS, type Sighting } from "@shared/scan";
import { type SubmitEvent, useState } from "react";
import { useApp } from "../../app/state";
import { Toggle } from "../../components/fields";

/** The same findings as a scan, ticked by hand: no photo, no model. */
export function Checklist({ onDone }: { onDone: (kinds: Sighting[]) => void }) {
  const { t } = useApp();
  const [ticked, setTicked] = useState<Sighting[]>([]);
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    onDone(SIGHTINGS.filter((k) => ticked.includes(k)));
  };
  return (
    <form onSubmit={submit} className="mt-8 max-w-xl">
      <fieldset>
        <legend className="text-lg font-semibold">{t("indoors.checklist")}</legend>
        <p className="mt-1 text-sm text-muted">{t("indoors.checklistLead")}</p>
        <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
          {SIGHTINGS.map((k) => (
            <Toggle
              key={k}
              label={t(`scan.kind.${k}`)}
              checked={ticked.includes(k)}
              onChange={(on) => setTicked((ks) => (on ? [...ks, k] : ks.filter((x) => x !== k)))}
            />
          ))}
        </div>
      </fieldset>
      <button type="submit" className="btn btn-primary mt-6">
        {t("indoors.rank")}
      </button>
    </form>
  );
}
