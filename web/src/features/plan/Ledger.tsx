import type { Candidate } from "@shared/actions/catalogue";
import { short, sig } from "@shared/format";
import { CIGARETTE_EXPOSURE } from "@shared/i18n/reason";
import { useApp } from "../../app/state";

export type Totals = { cig: number; co2: number; pm: number; inrPerDay: number; inrOnce: number };

/** Central figures summed over a set of steps; negatives (a running cost, a worse trip) count against. */
export function totals(steps: readonly Candidate[]): Totals {
  const sum = (pick: (c: Candidate) => number) => steps.reduce((acc, c) => acc + pick(c), 0);
  return {
    cig: Math.max(0, sum((c) => c.impact.exposure?.mid ?? 0) / CIGARETTE_EXPOSURE),
    co2: sum((c) => c.impact.co2kg?.mid ?? 0),
    pm: sum((c) => c.impact.pm25g?.mid ?? 0),
    inrPerDay: sum((c) => c.impact.inrPerDay?.mid ?? 0),
    inrOnce: sum((c) => c.impact.inrOnce?.mid ?? 0),
  };
}

/** A headline figure: whole numbers from 10, one decimal below, and "<0.1" for a trace. */
function figure(n: number): string {
  if (n >= 10) return String(Math.round(n));
  if (n >= 0.1) return n.toFixed(1);
  return n > 0 ? "<0.1" : "0";
}

function Figures({ totals: x, large }: { totals: Totals; large: boolean }) {
  const { t } = useApp();
  const value = large ? "num text-5xl leading-none" : "num text-3xl leading-none";
  const money = Math.round(Math.abs(x.inrPerDay));
  return (
    <dl className="mt-3 space-y-5">
      <div>
        <dt className="sr-only">{t("impact.protect")}</dt>
        <dd>
          <span className={value}>{figure(x.cig)}</span>
          <span className="mt-1 block text-sm text-muted">{t("ledger.cig")}</span>
        </dd>
      </div>
      <div>
        <dt className="sr-only">{t("impact.prevent")}</dt>
        <dd>
          <span className={value}>{figure(x.co2)}</span>
          <span className="mt-1 block text-sm text-muted">
            {t("ledger.co2")} {x.pm > 0 && t("ledger.preventPm", { pm: short(x.pm) })}
          </span>
        </dd>
      </div>
      <div>
        <dt className="sr-only">{t("impact.wallet")}</dt>
        <dd>
          <span className={value}>₹{money}</span>
          <span className="mt-1 block text-sm text-muted">
            {t(x.inrPerDay >= 0 ? "ledger.saves" : "ledger.spends")}
            {x.inrOnce > 0 && `, ${t("ledger.once", { once: sig(x.inrOnce) })}`}
          </span>
        </dd>
      </div>
    </dl>
  );
}

/**
 * The day's breathprint: what the whole plan would do, and what the steps
 * marked done have done so far. The second half is announced as it changes.
 */
export function Ledger({
  planned,
  done,
}: {
  planned: readonly Candidate[];
  done: readonly Candidate[];
}) {
  const { t } = useApp();
  return (
    <section aria-labelledby="ledger-title" className="border-t-2 border-ink pt-5">
      <h2 id="ledger-title" className="num text-3xl leading-tight">
        {t("ledger.title")}
      </h2>
      <h3 className="mt-5 text-sm font-semibold">{t("ledger.ifAll")}</h3>
      <Figures totals={totals(planned)} large />
      <div aria-live="polite" className="mt-8 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">{t("ledger.doneSoFar")}</h3>
        <Figures totals={totals(done)} large={false} />
      </div>
      <p className="mt-8 text-xs text-muted">{t("ledger.note")}</p>
    </section>
  );
}
