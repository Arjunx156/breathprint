import type { Candidate } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import { names } from "@shared/i18n";
import { ruleReason } from "@shared/i18n/reason";
import { alternativesFor, type DayPlan, type PlanStep, timeFor } from "@shared/plan";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApp } from "../../app/state";
import { ImpactPanel } from "./ImpactPanel";
import { Ledger } from "./Ledger";

type Step = PlanStep & { origin: string; candidate: Candidate };

type ItemProps = {
  ctx: Context;
  step: Step;
  alternatives: readonly string[];
  onSwap: (actionId: string) => void;
};

function StepItem({ ctx, step, alternatives, onSwap }: ItemProps) {
  const { t, tx, lang, done, toggleDone } = useApp();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(step.actionId);
  const id = step.actionId;
  const title = tx(`action.${id}.title`);
  const people = ctx.profile.members.filter((m) => step.who.includes(m.id));
  const isDone = done.has(id);

  // After a swap the button that was pressed is gone; keep focus on this step.
  useEffect(() => {
    if (shown.current === id) return;
    shown.current = id;
    heading.current?.focus();
  }, [id]);

  return (
    <li className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-4 border-t border-line py-7 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-6">
      <p className="num pt-0.5 text-[1.75rem] leading-none sm:text-4xl">{step.time}</p>
      <div className={isDone ? "text-muted" : undefined}>
        <h3
          ref={heading}
          tabIndex={-1}
          className="text-lg font-semibold leading-snug outline-offset-4"
        >
          {title}
        </h3>
        {people.length > 0 && (
          <p className="mt-0.5 text-sm text-muted">
            {t("plan.for", { who: names(lang, people, ctx.profile.members) })}
          </p>
        )}
        <p className="mt-2 max-w-prose">{step.reason}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-6">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 font-medium text-ink">
            <input type="checkbox" checked={isDone} onChange={() => toggleDone(id)} />
            {t("plan.done")}
            <span className="sr-only">: {title}</span>
          </label>
          <button
            type="button"
            className="link min-h-11 font-medium"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t("plan.hideNumbers") : t("plan.numbers")}
          </button>
        </div>

        {alternatives.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t("plan.swaps")}</span>
            {alternatives.map((alt) => (
              <button
                key={alt}
                type="button"
                className="btn btn-quiet min-h-10 px-3.5 py-1.5 text-sm font-medium text-ink"
                onClick={() => onSwap(alt)}
              >
                {tx(`action.${alt}.title`)}
              </button>
            ))}
          </div>
        )}

        <div id={panelId} hidden={!open} className="text-ink">
          {open && <ImpactPanel ctx={ctx} candidate={step.candidate} time={step.time} />}
        </div>
      </div>
    </li>
  );
}

type Props = { ctx: Context; ranked: readonly Candidate[]; plan: DayPlan };

/**
 * The plan as a timeline, beside the running breathprint. Swapping in an
 * alternative re-times and re-explains the step from the engine's numbers.
 */
export function PlanSection({ ctx, ranked, plan }: Props) {
  const { t, lang, done } = useApp();
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const byId = useMemo(() => new Map(ranked.map((c) => [c.action.id, c])), [ranked]);

  const steps = useMemo<Step[]>(() => {
    const reason = ruleReason(lang);
    return plan.steps
      .flatMap((step): Step[] => {
        const chosen = swaps[step.actionId];
        const candidate = byId.get(chosen ?? step.actionId);
        if (!candidate) return [];
        if (!chosen) return [{ ...step, origin: step.actionId, candidate }];
        const time = timeFor(ctx, candidate.action);
        return [
          {
            actionId: chosen,
            time,
            who: candidate.who,
            reason: reason(ctx, candidate, time),
            origin: step.actionId,
            candidate,
          },
        ];
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [plan, swaps, byId, ctx, lang]);

  const swap = (origin: string, next: string) =>
    setSwaps(({ [origin]: _, ...rest }) => (next === origin ? rest : { ...rest, [origin]: next }));

  return (
    <div className="mt-20 grid gap-14 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-20">
      <section aria-labelledby="plan-title">
        <h2 id="plan-title" className="num text-4xl leading-tight sm:text-5xl">
          {t("plan.title")}
        </h2>
        <p className="mt-2 text-muted">{t("plan.rules")}</p>
        {steps.length === 0 ? (
          <p className="mt-8 text-lg">{t("plan.empty")}</p>
        ) : (
          <ol className="mt-8 border-b border-line">
            {steps.map((step) => (
              <StepItem
                key={step.origin}
                ctx={ctx}
                step={step}
                alternatives={alternativesFor(ranked, step.actionId)}
                onSwap={(next) => swap(step.origin, next)}
              />
            ))}
          </ol>
        )}
      </section>
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <Ledger
          planned={steps.map((s) => s.candidate)}
          done={steps.filter((s) => done.has(s.actionId)).map((s) => s.candidate)}
        />
      </aside>
    </div>
  );
}
