import { EXERCISE, MAX_TRIP_KM, type Member, TRAVEL_MODES, type Trip } from "@shared/profile";
import { useApp } from "../../app/state";
import { Choice, Select, TextField, Toggle } from "../../components/fields";
import { type StepProps, useMemberLabel } from "./steps";

type TripProps = {
  legend: string;
  trip: Trip | null;
  /** What a trip starts as when its mode is first set. */
  fallback: Trip;
  members: readonly Member[];
  onChange: (trip: Trip | null) => void;
};

function TripFields({ legend, trip, fallback, members, onChange }: TripProps) {
  const { t } = useApp();
  const label = useMemberLabel();
  const mode = trip?.mode ?? "none";
  return (
    <fieldset className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <legend className="sr-only">{legend}</legend>
      <p className="mb-4 font-semibold" aria-hidden="true">
        {legend}
      </p>
      <Select
        legend={t("setup.mode")}
        options={TRAVEL_MODES}
        value={mode}
        label={(m) => t(`mode.${m}`)}
        onChange={(next) =>
          onChange(next === "none" ? null : { ...(trip ?? fallback), mode: next })
        }
      />
      {trip && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <TextField
              label={t("setup.km")}
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_TRIP_KM}
              step={0.5}
              value={String(trip.km)}
              onChange={(v) =>
                onChange({ ...trip, km: Math.min(MAX_TRIP_KM, Math.max(0, Number(v) || 0)) })
              }
            />
            <TextField
              label={t("setup.leave")}
              type="time"
              value={trip.leaveAt}
              onChange={(leaveAt) => leaveAt && onChange({ ...trip, leaveAt })}
            />
            <TextField
              label={t("setup.return")}
              type="time"
              value={trip.returnAt}
              onChange={(returnAt) => returnAt && onChange({ ...trip, returnAt })}
            />
          </div>
          <fieldset className="mt-4">
            <legend className="font-medium">{t("setup.who")}</legend>
            <div className="mt-1 grid gap-x-6 sm:grid-cols-3">
              {members.map((m, i) => (
                <Toggle
                  key={m.id}
                  label={label(m, i)}
                  checked={trip.who.includes(m.id)}
                  onChange={(on) =>
                    onChange({
                      ...trip,
                      who: on ? [...trip.who, m.id] : trip.who.filter((w) => w !== m.id),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        </>
      )}
    </fieldset>
  );
}

/** The commute, the school run and outdoor exercise. */
export function TravelStep({ draft, update }: StepProps) {
  const { t } = useApp();
  const adult = draft.members.find((m) => m.group === "adult")?.id;
  const young = draft.members
    .filter((m) => m.group === "child" || m.group === "teen")
    .map((m) => m.id);
  return (
    <div>
      <TripFields
        legend={t("setup.commute")}
        trip={draft.commute}
        members={draft.members}
        fallback={{
          mode: "car",
          km: 10,
          leaveAt: "08:30",
          returnAt: "18:30",
          who: adult ? [adult] : [],
        }}
        onChange={(commute) => update({ ...draft, commute })}
      />
      <TripFields
        legend={t("setup.schoolRun")}
        trip={draft.schoolRun}
        members={draft.members}
        fallback={{
          mode: "walk",
          km: 1,
          leaveAt: "07:30",
          returnAt: "14:00",
          who: adult ? [...young, adult] : young,
        }}
        onChange={(schoolRun) => update({ ...draft, schoolRun })}
      />
      <div className="border-t border-line pt-6">
        <Choice
          legend={t("setup.exercise")}
          options={EXERCISE}
          value={draft.exercise}
          label={(e) => t(`exercise.${e}`)}
          onChange={(exercise) => update({ ...draft, exercise })}
        />
      </div>
    </div>
  );
}
