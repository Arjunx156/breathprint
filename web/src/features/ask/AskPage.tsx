import { readAnswer } from "@shared/answer";
import { cardById, search } from "@shared/knowledge/search";
import type { Profile } from "@shared/profile";
import { type ChatEvent, MAX_CHARS } from "@shared/replies";
import { type SourceId, sourceOf } from "@shared/sources";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, Redirect } from "wouter";
import { useApp } from "../../app/state";
import { chat, type Turn } from "./chat";

type Exchange = {
  id: number;
  question: string;
  answer: string;
  state: "streaming" | "done" | "broken" | "offline";
  flags: string[];
  recorded: boolean;
};

function step(x: Exchange, event: ChatEvent): Exchange {
  switch (event.type) {
    case "text":
      return { ...x, answer: x.answer + event.text };
    case "done":
      return { ...x, state: "done", flags: event.flags, recorded: event.recorded };
    case "error":
      return { ...x, state: "broken" };
  }
}

/** Earlier exchanges that got an answer, then the new question. */
function history(exchanges: readonly Exchange[], question: string): Turn[] {
  const earlier = exchanges.flatMap((x): Turn[] =>
    x.answer.trim()
      ? [
          { role: "user", text: x.question },
          { role: "model", text: x.answer },
        ]
      : [],
  );
  return [...earlier, { role: "user", text: question }];
}

function SourceLinks({ ids }: { ids: readonly SourceId[] }) {
  return ids.map((id, i) => {
    const source = sourceOf(id);
    return (
      <span key={id}>
        {i > 0 && <span aria-hidden="true"> · </span>}
        <a className="link" href={source.url} target="_blank" rel="noopener noreferrer">
          {source.publisher}, {source.year}
        </a>
      </span>
    );
  });
}

function Cited({ cards, actions }: { cards: readonly string[]; actions: readonly string[] }) {
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
                  <span className="block">{lang === "hi" ? card.titleHi : card.title}</span>
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
function Library({ question }: { question: string }) {
  const { t, lang } = useApp();
  const hits = useMemo(() => search(question, 3), [question]);
  if (hits.length === 0) return <p className="mt-4 max-w-prose">{t("ask.nothing")}</p>;
  return (
    <div className="mt-4">
      <p className="max-w-prose text-muted">{t("ask.offline")}</p>
      <ul className="mt-6 space-y-7">
        {hits.map(({ card }) => (
          <li key={card.id} className="max-w-prose">
            <h3 className="font-semibold">{lang === "hi" ? card.titleHi : card.title}</h3>
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

function ExchangeView({ x }: { x: Exchange }) {
  const { t } = useApp();
  const answer = readAnswer(x.answer);
  const streaming = x.state === "streaming";
  return (
    <article className="scroll-mt-6 border-t border-line py-8" data-exchange={x.id}>
      <h2 className="text-xl font-semibold leading-snug">
        <span className="sr-only">{t("ask.you")}: </span>
        {x.question}
      </h2>
      <div aria-live="polite" aria-busy={streaming} className="mt-4 max-w-prose space-y-3">
        {streaming && answer.blocks.length === 0 && (
          <p className="flex items-center gap-3 text-muted">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse"
            />
            {t("ask.asking")}
          </p>
        )}
        {answer.blocks.map((block, i) =>
          block.kind === "p" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks only ever grow at the end.
            <p key={i}>{block.text}</p>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks only ever grow at the end.
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted">
              {block.items.map((item, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: items only ever grow at the end.
                <li key={j}>{item}</li>
              ))}
            </ul>
          ),
        )}
        {x.state === "offline" && <Library question={x.question} />}
      </div>
      {!streaming && <Cited cards={answer.cards} actions={answer.actions} />}
      {x.flags.length > 0 && (
        <p className="mt-6 max-w-prose border-l-2 border-[var(--lvl-3)] pl-3 text-sm">
          {t("ask.flagged", { figures: x.flags.join(", ") })}
        </p>
      )}
      {x.recorded && <p className="mt-4 text-sm text-muted">{t("ask.recorded")}</p>}
      {x.state === "broken" && <p className="mt-4 text-sm">{t("ask.broken")}</p>}
    </article>
  );
}

function Ask({ profile }: { profile: Profile }) {
  const { t, lang, demo } = useApp();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const active = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const fieldId = useId();
  const busy = exchanges.at(-1)?.state === "streaming";

  useEffect(() => () => active.current?.abort(), []);

  // Bring each new question to the top so its answer streams in view.
  const latest = exchanges.at(-1)?.id;
  useEffect(() => {
    if (latest === undefined) return;
    document.querySelector(`[data-exchange="${latest}"]`)?.scrollIntoView({ block: "start" });
  }, [latest]);

  const ask = async (raw: string) => {
    const question = raw.trim().slice(0, MAX_CHARS);
    if (!question || busy) return;
    const id = nextId.current++;
    const turns = history(exchanges, question);
    const patch = (change: (x: Exchange) => Exchange) =>
      setExchanges((xs) => xs.map((x) => (x.id === id ? change(x) : x)));
    setExchanges((xs) => [
      ...xs,
      { id, question, answer: "", state: "streaming", flags: [], recorded: false },
    ]);
    setDraft("");
    const controller = new AbortController();
    active.current = controller;
    try {
      for await (const event of chat({ profile, lang, demo, turns }, controller.signal)) {
        patch((x) => step(x, event));
      }
      patch((x) => (x.state === "streaming" ? { ...x, state: "broken" } : x));
    } catch {
      if (!controller.signal.aborted)
        patch((x) => ({ ...x, state: x.answer ? "broken" : "offline" }));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter asks, Shift+Enter adds a line; never mid-composition in a Hindi keyboard.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void ask(draft);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="num text-5xl leading-tight">{t("ask.title")}</h1>
      <p className="mt-3 max-w-prose text-muted">{t("ask.lead", { place: profile.place.name })}</p>

      {exchanges.length > 0 && (
        <div className="mt-10 border-b border-line">
          {exchanges.map((x) => (
            <ExchangeView key={x.id} x={x} />
          ))}
        </div>
      )}

      <form
        className="mt-10"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <label htmlFor={fieldId} className="mb-1.5 block font-medium">
          {t("ask.label")}
        </label>
        <textarea
          id={fieldId}
          className="field min-h-24 resize-y"
          rows={3}
          maxLength={MAX_CHARS}
          value={draft}
          placeholder={t("ask.placeholder")}
          aria-describedby={`${fieldId}-note`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
            {busy ? t("ask.asking") : t("ask.submit")}
          </button>
          <p id={`${fieldId}-note`} className="text-sm text-muted">
            {t("ask.privacy")}
          </p>
        </div>
      </form>

      {exchanges.length === 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted">{t("ask.suggest")}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(["ask.q1", "ask.q2", "ask.q3"] as const).map((key) => (
              <li key={key}>
                <button
                  type="button"
                  className="btn btn-quiet h-auto py-2 text-left text-sm font-medium"
                  onClick={() => void ask(t(key))}
                >
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-12 max-w-prose border-l-2 border-line pl-3 text-sm text-muted">
        {t("ask.medical")}
      </p>
    </div>
  );
}

export default function AskPage() {
  const { profile } = useApp();
  if (!profile) return <Redirect to="/setup" replace />;
  return <Ask profile={profile} />;
}
