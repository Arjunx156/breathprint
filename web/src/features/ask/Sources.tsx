import { titleOf } from "@shared/knowledge/cards";
import { cardById, search } from "@shared/knowledge/search";
import { type SourceId, sourceOf } from "@shared/sources";
import { useMemo } from "react";
import { Link } from "wouter";
import { useApp } from "../../app/state";
import { ExternalLink } from "../../components/ExternalLink";

function SourceLinks({ ids }: { ids: readonly SourceId[] }) {
  return ids.map((id, i) => {
    const source = sourceOf(id);
    return (
      <span key={id}>
        {i > 0 && <span aria-hidden="true"> · </span>}
        <ExternalLink href={source.url}>
          {source.publisher}, {source.year}
        </ExternalLink>
      </span>
    );
  });
}

/** The cards an answer cites, with their sources, and the steps it points to. */
export function Cited({
  cards,
  actions,
}: {
  cards: readonly string[];
  actions: readonly string[];
}) {
  const { t, tx, lang } = useApp();
  return (
    <div className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
      {cards.length > 0 && (
        <div>
          <h3 className="font-semibold">{t("ask.sources")}</h3>
          <ul className="mt-2 space-y-2">
            {cards.map((id) => {
              const card = cardById(id);
              if (!card) return null;
              return (
                <li key={id}>
                  <span className="block">{titleOf(card, lang)}</span>
                  <SourceLinks ids={card.sources} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {actions.length > 0 && (
        <div>
          <h3 className="font-semibold">{t("ask.actions")}</h3>
          <ul className="mt-2 space-y-2">
            {actions.map((id) => (
              <li key={id}>
                <Link href="/" className="link">
                  {tx(`action.${id}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Breathprint's own notes, when the model can't answer. */
export function Library({ question }: { question: string }) {
  const { t, lang } = useApp();
  const hits = useMemo(() => search(question, 3), [question]);
  if (hits.length === 0) return <p className="mt-4 max-w-prose">{t("ask.nothing")}</p>;
  return (
    <div className="mt-4">
      <p className="max-w-prose text-muted">{t("ask.offline")}</p>
      <ul className="mt-6 space-y-7">
        {hits.map(({ card }) => (
          <li key={card.id} className="max-w-prose">
            <h3 className="font-semibold">{titleOf(card, lang)}</h3>
            <p className="mt-1" lang="en">
              {card.body}
            </p>
            <p className="mt-1.5 text-sm">
              <SourceLinks ids={card.sources} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
