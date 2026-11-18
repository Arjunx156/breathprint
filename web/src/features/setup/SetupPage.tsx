import { defaultProfile, type Place, type Profile, ProfileSchema } from "@shared/profile";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "../../app/state";
import { HomeStep } from "./HomeStep";
import { HouseholdStep } from "./HouseholdStep";
import { PlaceStep } from "./PlaceStep";
import { PrefsStep } from "./PrefsStep";
import { STEPS, type StepProps } from "./steps";
import { TravelStep } from "./TravelStep";

/** The steps after the place, in order; each edits the shared draft. */
const DRAFT_STEPS = [HouseholdStep, TravelStep, HomeStep, PrefsStep] as const;

function StepProgress({ step }: { step: number }) {
  const { t } = useApp();
  return (
    <div className="mt-10">
      <p className="text-sm text-muted">{t("setup.step", { n: step + 1, total: STEPS.length })}</p>
      <div className="mt-2 grid grid-cols-5 gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

function CurrentStep({ step, draft, update }: StepProps & { step: number }) {
  const Step = DRAFT_STEPS[step - 1];
  return Step ? <Step draft={draft} update={update} /> : null;
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

  return (
    <div className="max-w-2xl">
      <h1 className="num text-5xl leading-tight">{t("setup.title")}</h1>
      <p className="mt-3 max-w-prose text-muted">{t("setup.intro")}</p>

      <StepProgress step={step} />

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (last) finish();
          else setStep(step + 1);
        }}
      >
        <h2 ref={heading} tabIndex={-1} className="mb-6 text-2xl font-semibold outline-offset-4">
          {t(STEPS[step] ?? "setup.place")}
        </h2>

        {step === 0 ? (
          <PlaceStep place={draft?.place ?? null} onPlace={choosePlace} />
        ) : (
          draft && <CurrentStep step={step} draft={draft} update={setDraft} />
        )}

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
