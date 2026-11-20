import { type ChangeEvent, useId } from "react";
import { useApp } from "../../app/state";
import { type Photo, preparePhoto, samplePhoto } from "./photo";

/** The photo about to be scanned. */
export function PhotoPreview({ photo }: { photo: Photo }) {
  const { t } = useApp();
  return (
    <img
      src={photo.url}
      alt={photo.sample ? t("indoors.sampleAlt") : t("indoors.photoAlt")}
      className="max-h-80 w-auto max-w-full rounded-xl ring-1 ring-line"
    />
  );
}

/** Choose a photo, try the sample kitchen, or skip photos and tick a list. */
export function Picker({
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
export function Consent({ onScan, onBack }: { onScan: () => void; onBack: () => void }) {
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
