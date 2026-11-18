import type { Candidate } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import type { AirSummary } from "@shared/air";
import { timeFor } from "@shared/plan";
import type { Profile } from "@shared/profile";
import {
  type Change,
  homeChanges,
  type Scan,
  SIGHTINGS,
  type Sighting,
  scanFixes,
  sightingsOf,
  withSightings,
} from "@shared/scan";
import {
  type ChangeEvent,
  type FormEvent,
  lazy,
  type RefObject,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Redirect } from "wouter";
import { useApp } from "../../app/state";
import { AirFailed, AirWaiting } from "../../components/AirStatus";
import { Toggle } from "../../components/fields";
import { useAir } from "../../lib/useAir";
import { type Photo, preparePhoto, samplePhoto, scanPhoto } from "./photo";

const ImpactPanel = lazy(() =>
  import("../plan/ImpactPanel").then((m) => ({ default: m.ImpactPanel })),
);

/** What the page shows: pick a photo, check it, wait, then read what was found. */
type Stage =
  | { kind: "pick"; error: boolean }
  | { kind: "ready"; photo: Photo }
  | { kind: "scanning"; photo: Photo }
  | { kind: "found"; photo: Photo; scan: Scan; recorded: boolean }
  | { kind: "ticking"; photo: Photo | null; failed: boolean }
  | { kind: "ticked"; photo: Photo | null; kinds: Sighting[] };

/** The household words for one change, such as "Incense burns at home". */
function changeKey({ field, to }: Change): string {
  if (field === "chimney") return `scan.home.chimney.${String(to)}`;
  return typeof to === "boolean" ? `scan.home.${field}` : `scan.home.${field}.${to}`;
}

function PhotoPreview({ photo }: { photo: Photo }) {
  const { t } = useApp();
  return (
    <img
      src={photo.url}
      alt={photo.sample ? t("indoors.sampleAlt") : t("indoors.photoAlt")}
      className="max-h-80 w-auto max-w-full rounded-xl ring-1 ring-line"
    />
  );
}

function Fix({ ctx, candidate }: { ctx: Context; candidate: Candidate }) {
  const { t, tx } = useApp();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const id = candidate.action.id;
  return (
    <li className="border-t border-line py-6">
      <h3 className="text-lg font-semibold leading-snug">{tx(`action.${id}.title`)}</h3>
      <p className="mt-1 max-w-prose">{tx(`action.${id}.detail`)}</p>
      <button
        type="button"
        className="link mt-2 min-h-11 font-medium"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? t("plan.hideNumbers") : t("plan.numbers")}
      </button>
      <div id={panelId} hidden={!open}>
        {open && (
          <Suspense
            fallback={<p className="mt-4 text-sm text-muted">{t("plan.loadingNumbers")}</p>}
          >
            <ImpactPanel ctx={ctx} candidate={candidate} time={timeFor(ctx, candidate.action)} />
          </Suspense>
        )}
      </div>
    </li>
  );
}

function Findings({
  profile,
  summary,
  kinds,
  scan,
  headingRef,
}: {
  profile: Profile;
  summary: AirSummary;
  kinds: readonly Sighting[];
  scan: Scan | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { t, tx, lang, saveProfile } = useApp();
  const [saved, setSaved] = useState(false);
  // Fixed at first sight: once saved, the household already matches and the list would empty.
  const [changes] = useState(() => homeChanges(profile.home, kinds));
  const scanned = useMemo(() => withSightings(profile, kinds), [profile, kinds]);
  const ctx = useMemo<Context>(() => ({ profile: scanned, air: summary }), [scanned, summary]);
  const fixes = useMemo(
    () => scanFixes({ profile, air: summary }, kinds),
    [profile, summary, kinds],
  );
  const notes = new Map(scan?.sightings.map((s) => [s.kind, s.where]));

  return (
    <div className="mt-12 space-y-12">
      <section aria-labelledby="seen-title">
        <h2
          id="seen-title"
          ref={headingRef}
          tabIndex={-1}
          className="num text-4xl leading-tight outline-offset-4"
        >
          {t("indoors.seen")}
        </h2>
        {scan && scan.room !== "notRoom" && (
          <p className="mt-2 text-muted">
            {t("indoors.room", { room: tx(`scan.room.${scan.room}`) })}
          </p>
        )}
        {scan?.room === "notRoom" ? (
          <p className="mt-4 max-w-prose text-lg">{t("indoors.notRoom")}</p>
        ) : kinds.length === 0 ? (
          <p className="mt-4 max-w-prose text-lg">{t("indoors.nothing")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {kinds.map((k) => (
              <li key={k} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-semibold">{t(`scan.kind.${k}`)}</span>
                {notes.get(k) && (
                  <span lang={lang} className="text-muted">
                    {notes.get(k)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {kinds.length > 0 && (
        <section aria-labelledby="fixes-title">
          <h2 id="fixes-title" className="num text-4xl leading-tight">
            {t("indoors.fixes")}
          </h2>
          {fixes.length === 0 ? (
            <p className="mt-4 text-lg">{t("indoors.noFixes")}</p>
          ) : (
            <>
              <p className="mt-2 max-w-prose text-muted">{t("indoors.fixesLead")}</p>
              <ol className="mt-6 border-b border-line">
                {fixes.map((c) => (
                  <Fix key={c.action.id} ctx={ctx} candidate={c} />
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {changes.length > 0 && (
        <section className="rounded-2xl bg-surface p-6 ring-1 ring-line sm:p-8">
          <p className="font-semibold">{t("indoors.saveLead")}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 marker:text-muted">
            {changes.map((c) => (
              <li key={c.field}>{tx(changeKey(c))}</li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              className="btn btn-primary"
              // aria-disabled rather than disabled, so focus stays put while "Saved" is read out.
              aria-disabled={saved}
              onClick={() => {
                if (saved) return;
                saveProfile(scanned);
                setSaved(true);
              }}
            >
              {t("indoors.save")}
            </button>
            <p role="status" className="text-sm">
              {saved && (
                <>
                  {t("indoors.saved")}{" "}
                  <Link href="/" className="link font-medium">
                    {t("indoors.toToday")}
                  </Link>
                </>
              )}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function Checklist({ onDone }: { onDone: (kinds: Sighting[]) => void }) {
  const { t } = useApp();
  const [ticked, setTicked] = useState<Sighting[]>([]);
  const submit = (e: FormEvent) => {
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

/** Choose a photo, try the sample kitchen, or skip photos and tick a list. */
function Picker({
  again,
  onPhoto,
  onFail,
  onSkip,
}: {
  again: boolean;
  onPhoto: (photo: Photo) => void;
  onFail: () => void;
  onSkip: (() => void) | null;
}) {
  const { t } = useApp();
  const inputId = useId();
  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) preparePhoto(file).then(onPhoto, onFail);
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="peer sr-only"
          onChange={choose}
        />
        <label
          htmlFor={inputId}
          className="btn btn-primary cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent"
        >
          {again ? t("indoors.another") : t("indoors.choose")}
        </label>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => samplePhoto().then(onPhoto, onFail)}
        >
          {t("indoors.sample")}
        </button>
      </div>
      {onSkip && (
        <button type="button" className="link mt-3 min-h-11 font-medium" onClick={onSkip}>
          {t("indoors.noPhoto")}
        </button>
      )}
    </div>
  );
}

/** Says where the photo goes before it goes. */
function Consent({ onScan, onBack }: { onScan: () => void; onBack: () => void }) {
  const { t } = useApp();
  return (
    <div className="max-w-prose">
      <p className="text-sm text-muted">{t("indoors.consent")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={onScan}>
          {t("indoors.scan")}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          {t("indoors.another")}
        </button>
      </div>
    </div>
  );
}

function ScanStatus({ stage }: { stage: Stage }) {
  const { t } = useApp();
  return (
    <div aria-live="polite" className="mt-6 min-h-6 text-sm">
      {stage.kind === "pick" && stage.error && <p>{t("indoors.badPhoto")}</p>}
      {stage.kind === "scanning" && (
        <p className="flex items-center gap-3 text-muted">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse"
          />
          {t("indoors.scanning")}
        </p>
      )}
      {stage.kind === "ticking" && stage.failed && <p>{t("indoors.failed")}</p>}
      {stage.kind === "found" && (
        <p className="text-muted">{stage.recorded ? t("indoors.recorded") : t("indoors.read")}</p>
      )}
    </div>
  );
}

function Indoors({ profile, summary }: { profile: Profile; summary: AirSummary }) {
  const { t, lang, demo } = useApp();
  const [stage, setStage] = useState<Stage>({ kind: "pick", error: false });
  const active = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const photo = "photo" in stage ? stage.photo : null;
  const result = stage.kind === "found" || stage.kind === "ticked" ? stage : null;
  const kinds = useMemo(
    () => (result?.kind === "found" ? sightingsOf(result.scan) : (result?.kinds ?? null)),
    [result],
  );

  useEffect(() => () => active.current?.abort(), []);
  // A shrunk photo lives in memory as a blob; let it go once it's off the page.
  useEffect(
    () => () => {
      if (photo && !photo.sample) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );
  // A fresh result takes focus, so a screen reader starts reading it at once.
  useEffect(() => {
    if (result) heading.current?.focus();
  }, [result]);

  const scan = (p: Photo) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStage({ kind: "scanning", photo: p });
    scanPhoto(p, lang, demo, controller.signal)
      .then(
        (reply): Stage => ({ kind: "found", photo: p, scan: reply.scan, recorded: reply.recorded }),
      )
      .catch((): Stage => ({ kind: "ticking", photo: p, failed: true }))
      .then((next) => {
        if (!controller.signal.aborted) setStage(next);
      });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="num text-5xl leading-tight">{t("indoors.title")}</h1>
      <p className="mt-3 max-w-prose text-muted">{t("indoors.lead")}</p>

      <div className="mt-8 space-y-5">
        {photo && <PhotoPreview photo={photo} />}
        {stage.kind === "ready" && (
          <Consent
            onScan={() => scan(stage.photo)}
            onBack={() => setStage({ kind: "pick", error: false })}
          />
        )}
        {(stage.kind === "pick" || result) && (
          <Picker
            again={photo !== null}
            onPhoto={(p) => setStage({ kind: "ready", photo: p })}
            onFail={() => setStage({ kind: "pick", error: true })}
            onSkip={
              stage.kind === "pick"
                ? () => setStage({ kind: "ticking", photo: null, failed: false })
                : null
            }
          />
        )}
      </div>

      <ScanStatus stage={stage} />

      {stage.kind === "ticking" && (
        <Checklist
          onDone={(picked) => setStage({ kind: "ticked", photo: stage.photo, kinds: picked })}
        />
      )}

      {kinds && (
        <Findings
          key={kinds.join()}
          profile={profile}
          summary={summary}
          kinds={kinds}
          scan={result?.kind === "found" ? result.scan : null}
          headingRef={heading}
        />
      )}
    </div>
  );
}

function IndoorsFor({ profile }: { profile: Profile }) {
  const { demo } = useApp();
  const air = useAir(profile.place, demo);
  if (air.status === "loading") return <AirWaiting place={profile.place.name} />;
  if (air.status === "error") return <AirFailed retry={air.retry} />;
  return <Indoors profile={profile} summary={air.summary} />;
}

export default function IndoorsPage() {
  const { profile } = useApp();
  if (!profile) return <Redirect to="/setup" replace />;
  return <IndoorsFor profile={profile} />;
}
