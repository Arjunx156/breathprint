import type { Candidate } from "@shared/actions/catalogue";
import type { Context, Impact } from "@shared/actions/types";
import { rupees, short } from "@shared/format";
import type { MessageKey } from "@shared/i18n";
import { impactVars } from "@shared/i18n/reason";
import type { Range } from "@shared/range";
import { sourceOf } from "@shared/sources";
import type { ReactNode } from "react";
import { useApp } from "../../app/state";
import { ExternalLink } from "../../components/ExternalLink";

/** Smallest change worth a line; below this the engine's rounding is noise. */
const NOTICEABLE = { dose: 0.5, co2: 0.005, pm: 0.0005, inr: 0.5 };

type Line = { key: MessageKey; range: Range; format: (n: number) => string };

/** A line for a figure worth showing, worded by its sign; nothing for noise. */
function signed(
  range: Range | null,
  floor: number,
  better: MessageKey,
  worse: MessageKey,
  format = short,
): Line[] {
  if (!range || Math.abs(range.mid) < floor) return [];
  return [{ key: range.mid > 0 ? better : worse, range, format }];
}

function linesOf(impact: Impact): Record<"protect" | "prevent" | "wallet", Line[]> {
  return {
    protect: signed(impact.dose, NOTICEABLE.dose, "impact.doseLess", "impact.doseMore"),
    prevent: [
      ...signed(impact.co2kg, NOTICEABLE.co2, "impact.co2", "impact.co2More"),
      ...signed(impact.pm25g, NOTICEABLE.pm, "impact.pm", "impact.pmMore"),
    ],
    wallet: [
      ...signed(impact.inrPerDay, NOTICEABLE.inr, "impact.saves", "impact.costs", rupees),
      ...(impact.inrOnce && impact.inrOnce.mid > 0
        ? [{ key: "impact.once" as const, range: impact.inrOnce, format: rupees }]
        : []),
    ],
  };
}

/** A figure, with the range behind it when the range says more than the figure alone. */
function LedgerLine({ line: { key, range, format } }: { line: Line }) {
  const { t } = useApp();
  const [low = 0, high = 0] = [Math.abs(range.low), Math.abs(range.high)].sort((a, b) => a - b);
  return (
    <p>
      <span className="font-medium">{t(key, { mid: format(Math.abs(range.mid)) })}</span>
      {format(low) !== format(high) && (
        <span className="block text-sm text-muted">
          {t("impact.range", { low: format(low), high: format(high) })}
        </span>
      )}
    </p>
  );
}

/** One ledger's lines and any note on them, or a plain "no change" when none is worth a line. */
function Ledger({ title, lines, note }: { title: string; lines: Line[]; note?: ReactNode }) {
  const { t } = useApp();
  return (
    <div>
      <h4 className="text-sm text-muted">{title}</h4>
      <div className="mt-1.5 space-y-1">
        {lines.length > 0 ? (
          <>
            {lines.map((line) => (
              <LedgerLine key={line.key} line={line} />
            ))}
            {note}
          </>
        ) : (
          <p className="text-muted">{t("impact.none")}</p>
        )}
      </div>
    </div>
  );
}

type Props = { ctx: Context; candidate: Candidate; time: string };

/** Protect, prevent and the wallet, side by side. */
function Ledgers({ ctx, candidate, time }: Props) {
  const { t, lang } = useApp();
  const { protect, prevent, wallet } = linesOf(candidate.impact);
  const vars = impactVars(lang, ctx, candidate, time);
  const share = candidate.impact.doseShare !== null && (
    <p className="text-sm text-muted">
      {t("impact.share", { pct: vars.pct ?? 0, who: vars.who ?? "" })}
    </p>
  );
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-3">
      <Ledger title={t("impact.protect")} lines={protect} note={share} />
      <Ledger title={t("impact.prevent")} lines={prevent} />
      <Ledger title={t("impact.wallet")} lines={wallet} />
    </div>
  );
}

/** The working behind the figures, one step a row. */
function Working({ method }: { method: Impact["method"] }) {
  const { t } = useApp();
  if (method.length === 0) return null;
  return (
    <>
      <h4 className="mt-6 text-sm font-semibold">{t("impact.method")}</h4>
      <dl className="mt-2 space-y-2 text-sm">
        {method.map((m) => (
          <div key={m.label} className="grid gap-x-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted">{t(m.label)}</dt>
            <dd className="tabular-nums [overflow-wrap:anywhere]">
              {m.formula} = <span className="font-medium">{m.result}</span>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Where each factor behind the figures comes from. */
function Sources({ ids }: { ids: Candidate["action"]["sources"] }) {
  const { t } = useApp();
  return (
    <>
      <h4 className="mt-6 text-sm font-semibold">{t("impact.sources")}</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {ids.map((id) => {
          const s = sourceOf(id);
          return (
            <li key={id}>
              <ExternalLink href={s.url}>{s.title}</ExternalLink>
              <span className="text-muted">
                , {s.publisher} {s.year}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * One action's two ledgers and its cost, each with the range behind the
 * central figure, then the working and the sources.
 */
export function ImpactPanel({ ctx, candidate, time }: Props) {
  const { t, tx } = useApp();
  const { action, impact } = candidate;
  return (
    <div className="mt-4 rounded-xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h3 className="text-sm font-semibold">{t("plan.how")}</h3>
      <p className="mt-1 max-w-prose">{tx(`action.${action.id}.detail`)}</p>
      {action.quantified ? (
        <Ledgers ctx={ctx} candidate={candidate} time={time} />
      ) : (
        <p className="mt-4 max-w-prose text-muted">{t("impact.qualitative")}</p>
      )}
      <Working method={impact.method} />
      <Sources ids={action.sources} />
    </div>
  );
}
