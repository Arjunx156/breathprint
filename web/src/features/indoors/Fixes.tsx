import type { Candidate } from "@shared/actions/catalogue";
import type { Context } from "@shared/actions/types";
import { timeFor } from "@shared/plan";
import { useApp } from "../../app/state";
import { NumbersButton, NumbersPanel, useNumbers } from "../plan/Numbers";

function Fix({ ctx, candidate }: { ctx: Context; candidate: Candidate }) {
  const { tx } = useApp();
  const numbers = useNumbers();
  const id = candidate.action.id;
  return (
    <li className="border-t border-line py-6">
      <h3 className="text-lg font-semibold leading-snug">{tx(`action.${id}.title`)}</h3>
      <p className="mt-1 max-w-prose">{tx(`action.${id}.detail`)}</p>
      <NumbersButton numbers={numbers} className="mt-2" />
      <NumbersPanel
        numbers={numbers}
        ctx={ctx}
        candidate={candidate}
        time={timeFor(ctx, candidate.action)}
      />
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
