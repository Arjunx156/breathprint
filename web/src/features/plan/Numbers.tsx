import type { Candidate } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import { lazy, Suspense, useId, useState } from "react";
import { useApp } from "../../app/state";

// The working and the sources behind an action load when someone reaches for them.
const loadPanel = () => import("./ImpactPanel");
const ImpactPanel = lazy(() => loadPanel().then((m) => ({ default: m.ImpactPanel })));

/** Whether an action's numbers are showing, and the id that ties the button to them. */
export function useNumbers() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return { open, panelId, toggle: () => setOpen((v) => !v) };
}

type Numbers = ReturnType<typeof useNumbers>;

/** Shows or hides the numbers, and starts fetching them as soon as a pointer or focus arrives. */
export function NumbersButton({ numbers, className }: { numbers: Numbers; className?: string }) {
  const { t } = useApp();
  return (
    <button
      type="button"
      className={`link min-h-11 font-medium ${className ?? ""}`}
      aria-expanded={numbers.open}
      aria-controls={numbers.panelId}
      onPointerEnter={loadPanel}
      onFocus={loadPanel}
      onClick={numbers.toggle}
    >
      {numbers.open ? t("plan.hideNumbers") : t("plan.numbers")}
    </button>
  );
}

type PanelProps = {
  numbers: Numbers;
  ctx: Context;
  candidate: Candidate;
  time: string;
  className?: string;
};

/** One action's impact panel, there only while it is open. */
export function NumbersPanel({ numbers, ctx, candidate, time, className }: PanelProps) {
  const { t } = useApp();
  return (
    <div id={numbers.panelId} hidden={!numbers.open} className={className}>
      {numbers.open && (
        <Suspense fallback={<p className="mt-4 text-sm text-muted">{t("plan.loadingNumbers")}</p>}>
          <ImpactPanel ctx={ctx} candidate={candidate} time={time} />
        </Suspense>
      )}
    </div>
  );
}
