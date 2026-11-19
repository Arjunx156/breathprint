import type { Candidate } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import { names } from "@shared/i18n";
import { ruleReason } from "@shared/i18n/reason";
import { alternativesFor, type DayPlan, type PlanStep, timeFor } from "@shared/plan";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../app/state";
import { Ledger } from "./Ledger";
import { NumbersButton, NumbersPanel, useNumbers } from "./Numbers";

type Step = PlanStep & { origin: string; candidate: Candidate };
/** Which alternative replaced which step, by the step's original action id. */
type Swaps = Readonly<Record<string, string>>;
const NO_SWAPS: Swaps = {};

type ItemProps = {
  ctx: Context;
  step: Step;
  alternatives: readonly string[];
  onSwap: (actionId: string) => void;
};

function StepItem({ ctx, step, alternatives, onSwap }: ItemProps) {
  const { t, tx, lang, done, toggleDone } = useApp();
  const numbers = useNumbers();
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
          <NumbersButton numbers={numbers} />
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

        <NumbersPanel
          numbers={numbers}
          ctx={ctx}
          candidate={step.candidate}
          time={step.time}
          className="text-ink"
        />
      </div>
    </li>
  );
}

type Props = {
  ctx: Context;
  ranked: readonly Candidate[];
  plan: DayPlan;
  /** Where a personalised plan is offered, under the title. */
  notice?: ReactNode;
};

/**
 * The plan as a timeline, beside the running breathprint. Swapping in an
 * alternative re-times and re-explains the step from the engine's numbers.
 */
export function PlanSection({ ctx, ranked, plan, notice }: Props) {
  const { t, lang, done } = useApp();
  // Swaps belong to the plan they were made on, so a new plan starts clean
  // without remounting the section and losing focus inside it.
  const planId = `${plan.source}:${plan.steps.map((s) => s.actionId).join()}`;
  const [made, setMade] = useState<{ planId: string; swaps: Swaps }>({ planId, swaps: NO_SWAPS });
  const swaps = made.planId === planId ? made.swaps : NO_SWAPS;
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

  const swap = (origin: string, next: string) => {
    const { [origin]: _, ...rest } = swaps;
    setMade({ planId, swaps: next === origin ? rest : { ...rest, [origin]: next } });
  };

  return (
    <div className="mt-20 grid gap-14 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-20">
      <section aria-labelledby="plan-title">
        <h2 id="plan-title" className="num text-4xl leading-tight sm:text-5xl">
          {t("plan.title")}
        </h2>
        {plan.source === "rules" && <p className="mt-2 text-muted">{t("plan.rules")}</p>}
        {notice}
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
