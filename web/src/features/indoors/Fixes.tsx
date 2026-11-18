import type { Candidate } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import { timeFor } from "@shared/plan";
import { lazy, Suspense, useId, useState } from "react";
import { useApp } from "../../app/state";

const ImpactPanel = lazy(() =>
  import("../plan/ImpactPanel").then((m) => ({ default: m.ImpactPanel })),
);

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

/** The engine's fixes for what was seen, best first, each with its numbers. */
export function Fixes({ ctx, fixes }: { ctx: Context; fixes: readonly Candidate[] }) {
  const { t } = useApp();
  return (
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
  );
}
