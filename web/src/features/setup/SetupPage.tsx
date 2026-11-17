import {
  AGE_GROUPS,
  BUDGETS,
  CONDITIONS,
  COOKING_FUELS,
  defaultProfile,
  EXERCISE,
  GRID_KM,
  HEATING,
  LANGUAGES,
  type Member,
  memberId,
  type Place,
  type Profile,
  ProfileSchema,
  TIGHTNESS,
  TRAVEL_MODES,
  type Trip,
} from "@shared/profile";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "../../app/state";
import { Choice, Select, TextField, Toggle } from "../../components/fields";
import { PlaceStep } from "./PlaceStep";

const STEPS = [
  "setup.place",
  "setup.household",
  "setup.travel",
  "setup.home",
  "setup.prefs",
] as const;
const SCALES = ["IN", "US"] as const;

type Patch = (next: Profile) => void;

function withName(member: Member, name: string): Member {
  const { name: _old, ...rest } = member;
  return name === "" ? rest : { ...rest, name };
}

function Household({ draft, update }: { draft: Profile; update: Patch }) {
  const { t } = useApp();
  const label = (m: Member, i: number) => m.name?.trim() || t("setup.person", { n: i + 1 });
  const setMember = (id: string, next: Member) =>
    update({ ...draft, members: draft.members.map((m) => (m.id === id ? next : m)) });
  const drop = (id: string) => {
    const without = (trip: Trip | null) =>
      trip ? { ...trip, who: trip.who.filter((w) => w !== id) } : null;
    update({
      ...draft,
      members: draft.members.filter((m) => m.id !== id),
      commute: without(draft.commute),
      schoolRun: without(draft.schoolRun),
    });
  };
  const add = () =>
    update({
      ...draft,
      members: [
        ...draft.members,
        {
          id: memberId(draft.members.map((m) => m.id)),
          group: "adult",
          conditions: [],
          outdoorWork: false,
        },
      ],
    });

  return (
    <div>
      {draft.members.map((m, i) => (
        <fieldset key={m.id} className="border-t border-line py-6 first:border-t-0 first:pt-0">
          <legend className="sr-only">{label(m, i)}</legend>
          <p className="mb-4 font-semibold" aria-hidden="true">
            {label(m, i)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t("setup.name")}
              value={m.name ?? ""}
              maxLength={40}
              autoComplete="off"
              onChange={(name) => setMember(m.id, withName(m, name))}
            />
            <Select
              legend={t("setup.group")}
              options={AGE_GROUPS}
              value={m.group}
              label={(g) => t(`groupLabel.${g}`)}
              onChange={(group) => setMember(m.id, { ...m, group })}
            />
          </div>
          <fieldset className="mt-4">
            <legend className="font-medium">{t("setup.conditions")}</legend>
            <div className="mt-1 grid gap-x-6 sm:grid-cols-3">
              {CONDITIONS.map((c) => (
                <Toggle
                  key={c}
                  label={t(`condition.${c}`)}
                  checked={m.conditions.includes(c)}
                  onChange={(on) =>
                    setMember(m.id, {
                      ...m,
                      conditions: on ? [...m.conditions, c] : m.conditions.filter((x) => x !== c),
                    })
                  }
                />
              ))}
              <Toggle
                label={t("setup.outdoorWork")}
                checked={m.outdoorWork}
                onChange={(outdoorWork) => setMember(m.id, { ...m, outdoorWork })}
              />
            </div>
          </fieldset>
          {draft.members.length > 1 && (
            <button type="button" className="link mt-2 min-h-11 text-sm" onClick={() => drop(m.id)}>
              {t("setup.remove", { who: label(m, i) })}
            </button>
          )}
        </fieldset>
      ))}
      {draft.members.length < 12 && (
        <button type="button" className="btn btn-quiet mt-2" onClick={add}>
          {t("setup.add")}
        </button>
      )}
    </div>
  );
}

type TripProps = {
  legend: string;
  trip: Trip | null;
  fallback: Trip;
  members: readonly Member[];
  onChange: (trip: Trip | null) => void;
};

function TripFields({ legend, trip, fallback, members, onChange }: TripProps) {
  const { t } = useApp();
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
              max={80}
              step={0.5}
              value={String(trip.km)}
              onChange={(v) => onChange({ ...trip, km: Math.min(80, Math.max(0, Number(v) || 0)) })}
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
                  label={m.name?.trim() || t("setup.person", { n: i + 1 })}
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

function Travel({ draft, update }: { draft: Profile; update: Patch }) {
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

function Home({ draft, update }: { draft: Profile; update: Patch }) {
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

function Preferences({ draft, update }: { draft: Profile; update: Patch }) {
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

/**
 * Five short steps, each optional past the place. Nothing is saved until the
 * last one, and then only to this device.
 */
export default function SetupPage() {
  const { t, lang, profile, saveProfile } = useApp();
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<Profile | null>(profile);
  const [step, setStep] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    void step; // Each new step moves focus to its heading.
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const choosePlace = (place: Place) =>
    setDraft((d) => (d ? { ...d, place } : { ...defaultProfile(place), language: lang }));

  const finish = () => {
    const parsed = ProfileSchema.safeParse(draft);
    if (!parsed.success) return setInvalid(true);
    saveProfile(parsed.data);
    navigate("/");
  };

  const last = step === STEPS.length - 1;
  const stepKey = STEPS[step] ?? "setup.place";

  return (
    <div className="max-w-2xl">
      <h1 className="num text-5xl leading-tight">{t("setup.title")}</h1>
      <p className="mt-3 max-w-prose text-muted">{t("setup.intro")}</p>

      <div className="mt-10">
        <p className="text-sm text-muted">
          {t("setup.step", { n: step + 1, total: STEPS.length })}
        </p>
        <div className="mt-2 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      </div>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (last) finish();
          else setStep(step + 1);
        }}
      >
        <h2 ref={heading} tabIndex={-1} className="mb-6 text-2xl font-semibold outline-offset-4">
          {t(stepKey)}
        </h2>

        {step === 0 && <PlaceStep place={draft?.place ?? null} onPlace={choosePlace} />}
        {draft && step === 1 && <Household draft={draft} update={setDraft} />}
        {draft && step === 2 && <Travel draft={draft} update={setDraft} />}
        {draft && step === 3 && <Home draft={draft} update={setDraft} />}
        {draft && step === 4 && <Preferences draft={draft} update={setDraft} />}

        {invalid && (
          <p role="alert" className="mt-6 border-l-2 border-[var(--lvl-4)] pl-3">
            {t("setup.invalid")}
          </p>
        )}

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
          {step > 0 ? (
            <button type="button" className="btn btn-quiet" onClick={() => setStep(step - 1)}>
              {t("setup.back")}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary" disabled={!draft}>
            {last ? t("setup.finish") : t("setup.next")}
          </button>
        </div>
      </form>
    </div>
  );
}
