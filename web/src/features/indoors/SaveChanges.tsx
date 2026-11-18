import type { Profile } from "@shared/profile";
import type { Change } from "@shared/scan";
import { useState } from "react";
import { Link } from "wouter";
import { useApp } from "../../app/state";

/** The household words for one change, such as "Incense burns at home". */
function changeKey({ field, to }: Change): string {
  if (field === "chimney") return `scan.home.chimney.${String(to)}`;
  return typeof to === "boolean" ? `scan.home.${field}` : `scan.home.${field}.${to}`;
}

/** Offers to update the household with what the scan found, so Today plans for it. */
export function SaveChanges({
  changes,
  scanned,
}: {
  changes: readonly Change[];
  scanned: Profile;
}) {
  const { t, tx, saveProfile } = useApp();
  const [saved, setSaved] = useState(false);
  return (
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
  );
}
