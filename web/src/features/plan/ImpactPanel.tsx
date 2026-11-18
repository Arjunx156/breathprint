import type { Candidate } from "@shared/actions/catalogue";
import type { Context, Impact } from "@shared/actions/types";
import { rupees, short } from "@shared/format";
import type { MessageKey } from "@shared/i18n";
import { impactVars } from "@shared/i18n/reason";
import type { Range } from "@shared/range";
import { sourceOf } from "@shared/sources";
import type { ReactNode } from "react";
import { useApp } from "../../app/state";

/** Smallest change worth a line; below this the engine's rounding is noise. */
const NOTICEABLE = { dose: 0.5, co2: 0.005, pm: 0.0005, inr: 0.5 };

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-sm text-muted">{title}</h4>
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}

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

function lines(impact: Impact): Record<"protect" | "prevent" | "wallet", Line[]> {
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

/**
 * One action's two ledgers and its cost, each with the range behind the
 * central figure, then the working and the sources.
 */
export function ImpactPanel({
  ctx,
  candidate,
  time,
}: {
  ctx: Context;
  candidate: Candidate;
  time: string;
}) {
  const { t, tx, lang } = useApp();
  const { action, impact } = candidate;
  const vars = impactVars(lang, ctx, candidate, time);
  const { protect, prevent, wallet } = lines(impact);

  const line = ({ key, range, format }: Line) => {
    const [low = 0, high = 0] = [Math.abs(range.low), Math.abs(range.high)].sort((a, b) => a - b);
    return (
      <p key={key}>
        <span className="font-medium">{t(key, { mid: format(Math.abs(range.mid)) })}</span>
        {format(low) !== format(high) && (
          <span className="block text-sm text-muted">
            {t("impact.range", { low: format(low), high: format(high) })}
          </span>
        )}
      </p>
    );
  };

  const none = <p className="text-muted">{t("impact.none")}</p>;

  return (
    <div className="mt-4 rounded-xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h3 className="text-sm font-semibold">{t("plan.how")}</h3>
      <p className="mt-1 max-w-prose">{tx(`action.${action.id}.detail`)}</p>

      {action.quantified ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Column title={t("impact.protect")}>
            {protect.length > 0 ? protect.map(line) : none}
            {impact.doseShare !== null && protect.length > 0 && (
              <p className="text-sm text-muted">
                {t("impact.share", { pct: vars.pct ?? 0, who: vars.who ?? "" })}
              </p>
            )}
          </Column>
          <Column title={t("impact.prevent")}>
            {prevent.length > 0 ? prevent.map(line) : none}
          </Column>
          <Column title={t("impact.wallet")}>{wallet.length > 0 ? wallet.map(line) : none}</Column>
        </div>
      ) : (
        <p className="mt-4 max-w-prose text-muted">{t("impact.qualitative")}</p>
      )}

      {impact.method.length > 0 && (
        <>
          <h4 className="mt-6 text-sm font-semibold">{t("impact.method")}</h4>
          <dl className="mt-2 space-y-2 text-sm">
            {impact.method.map((m) => (
              <div key={m.label} className="grid gap-x-4 sm:grid-cols-[12rem_1fr]">
                <dt className="text-muted">{t(m.label)}</dt>
                <dd className="tabular-nums [overflow-wrap:anywhere]">
                  {m.formula} = <span className="font-medium">{m.result}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <h4 className="mt-6 text-sm font-semibold">{t("impact.sources")}</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {action.sources.map((id) => {
          const s = sourceOf(id);
          return (
            <li key={id}>
              <a className="link" href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
              <span className="text-muted">
                , {s.publisher} {s.year}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
