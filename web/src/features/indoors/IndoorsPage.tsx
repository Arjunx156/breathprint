import type { AirSummary } from "@shared/air";
import type { Profile } from "@shared/profile";
import { sightingsOf } from "@shared/scan";
import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect } from "wouter";
import { useApp } from "../../app/state";
import { AirFailed, AirWaiting } from "../../components/AirStatus";
import { useAir } from "../../lib/useAir";
import { Checklist } from "./Checklist";
import { Findings } from "./Findings";
import { Consent, PhotoPreview, Picker } from "./PhotoControls";
import { type Photo, scanPhoto } from "./photo";
import { ScanStatus, type Stage } from "./ScanStatus";

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
