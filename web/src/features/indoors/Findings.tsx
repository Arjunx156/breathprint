import type { Context } from "@shared/actions/types";
import type { AirSummary } from "@shared/air";
import type { Profile } from "@shared/profile";
import { homeChanges, type Scan, type Sighting, scanFixes, withSightings } from "@shared/scan";
import { type RefObject, useMemo, useState } from "react";
import { useApp } from "../../app/state";
import { Fixes } from "./Fixes";
import { SaveChanges } from "./SaveChanges";

type Props = {
  profile: Profile;
  summary: AirSummary;
  kinds: readonly Sighting[];
  scan: Scan | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

/** The sources found, each with where the scan saw it, or why there are none to list. */
function Sightings({ kinds, scan }: Pick<Props, "kinds" | "scan">) {
  const { t, lang } = useApp();
  if (scan?.room === "notRoom") {
    return <p className="mt-4 max-w-prose text-lg">{t("indoors.notRoom")}</p>;
  }
  if (kinds.length === 0) {
    return <p className="mt-4 max-w-prose text-lg">{t("indoors.nothing")}</p>;
  }
  const notes = new Map(scan?.sightings.map((s) => [s.kind, s.where]));
  return (
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
  );
}

/** What the scan or the checklist found, the fixes ranked for it, and an offer to save it. */
export function Findings({ profile, summary, kinds, scan, headingRef }: Props) {
  const { t, tx } = useApp();
  // Fixed at first sight: once saved, the household already matches and the list would empty.
  const [changes] = useState(() => homeChanges(profile.home, kinds));
  const scanned = useMemo(() => withSightings(profile, kinds), [profile, kinds]);
  const ctx = useMemo<Context>(() => ({ profile: scanned, air: summary }), [scanned, summary]);
  const fixes = useMemo(
    () => scanFixes({ profile, air: summary }, kinds),
    [profile, summary, kinds],
  );
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
        <Sightings kinds={kinds} scan={scan} />
      </section>

      {kinds.length > 0 && <Fixes ctx={ctx} fixes={fixes} />}
      {changes.length > 0 && <SaveChanges changes={changes} scanned={scanned} />}
    </div>
  );
}
