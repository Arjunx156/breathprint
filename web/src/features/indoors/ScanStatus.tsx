import type { Scan, Sighting } from "@shared/scan";
import { useApp } from "../../app/state";
import type { Photo } from "./photo";

/** What the page shows: pick a photo, check it, wait, then read what was found. */
export type Stage =
  | { kind: "pick"; error: boolean }
  | { kind: "ready"; photo: Photo }
  | { kind: "scanning"; photo: Photo }
  | { kind: "found"; photo: Photo; scan: Scan; recorded: boolean }
  | { kind: "ticking"; photo: Photo | null; failed: boolean }
  | { kind: "ticked"; photo: Photo | null; kinds: Sighting[] };

/** One polite line on where the scan stands, read out as it changes. */
export function ScanStatus({ stage }: { stage: Stage }) {
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
