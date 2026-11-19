import { sightingsOf } from "@shared/scan";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../app/state";
import { type Air, AirPage } from "../../components/AirPage";
import { useLatestRequest } from "../../lib/useLatestRequest";
import { Checklist } from "./Checklist";
import { Findings } from "./Findings";
import { Consent, PhotoPreview, Picker } from "./PhotoControls";
import { type Photo, scanPhoto } from "./photo";
import { ScanStatus, type Stage } from "./ScanStatus";

const photoOf = (stage: Stage) => ("photo" in stage ? stage.photo : null);
const resultOf = (stage: Stage) =>
  stage.kind === "found" || stage.kind === "ticked" ? stage : null;

/** A shrunk photo lives in memory as a blob; let it go once it's off the page. */
function useReleased(photo: Photo | null) {
  useEffect(
    () => () => {
      if (photo && !photo.sample) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );
}

type PhotoStepProps = {
  stage: Stage;
  onStage: (next: Stage) => void;
  onScan: (photo: Photo) => void;
};

/** The photo, the consent to send it, and the picker, as far as the scan has got. */
function PhotoStep({ stage, onStage, onScan }: PhotoStepProps) {
  const photo = photoOf(stage);
  const picking = stage.kind === "pick";
  return (
    <div className="mt-8 space-y-5">
      {photo && <PhotoPreview photo={photo} />}
      {stage.kind === "ready" && (
        <Consent
          onScan={() => onScan(stage.photo)}
          onBack={() => onStage({ kind: "pick", error: false })}
        />
      )}
      {(picking || resultOf(stage)) && (
        <Picker
          again={photo !== null}
          onPhoto={(p) => onStage({ kind: "ready", photo: p })}
          onFail={() => onStage({ kind: "pick", error: true })}
          onSkip={picking ? () => onStage({ kind: "ticking", photo: null, failed: false }) : null}
        />
      )}
    </div>
  );
}

function Indoors({ profile, summary }: Air) {
  const { t, lang, demo } = useApp();
  const [stage, setStage] = useState<Stage>({ kind: "pick", error: false });
  const start = useLatestRequest();
  const heading = useRef<HTMLHeadingElement>(null);
  const result = resultOf(stage);
  const kinds = useMemo(
    () => (result?.kind === "found" ? sightingsOf(result.scan) : (result?.kinds ?? null)),
    [result],
  );
  useReleased(photoOf(stage));
  // A fresh result takes focus, so a screen reader starts reading it at once.
  useEffect(() => {
    if (result) heading.current?.focus();
  }, [result]);

  const scan = (p: Photo) => {
    const signal = start();
    setStage({ kind: "scanning", photo: p });
    // Settles into a stage either way, so nothing is left to await.
    void scanPhoto(p, lang, demo, signal)
      .then(
        (reply): Stage => ({ kind: "found", photo: p, scan: reply.scan, recorded: reply.recorded }),
      )
      .catch((): Stage => ({ kind: "ticking", photo: p, failed: true }))
      .then((next) => {
        if (!signal.aborted) setStage(next);
      });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="num text-5xl leading-tight">{t("indoors.title")}</h1>
      <p className="mt-3 max-w-prose text-muted">{t("indoors.lead")}</p>
      <PhotoStep stage={stage} onStage={setStage} onScan={scan} />
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

export default function IndoorsPage() {
  return <AirPage page={Indoors} />;
}
