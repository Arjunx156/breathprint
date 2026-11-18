import type { Profile } from "@shared/profile";
import { MAX_CHARS } from "@shared/replies";
import { useEffect, useRef, useState } from "react";
import { Redirect } from "wouter";
import { useApp } from "../../app/state";
import { useDictation, useReadAloud } from "../../lib/speech";
import { chat } from "./chat";
import { ExchangeView } from "./ExchangeView";
import { asked, type Exchange, history, step } from "./exchange";
import { QuestionForm } from "./QuestionForm";

const SUGGESTIONS = ["ask.q1", "ask.q2", "ask.q3"] as const;

function Suggestions({ onAsk }: { onAsk: (question: string) => void }) {
  const { t } = useApp();
  return (
    <div className="mt-10">
      <h2 className="text-sm font-medium text-muted">{t("ask.suggest")}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((key) => (
          <li key={key}>
            <button
              type="button"
              className="btn btn-quiet h-auto py-2 text-left text-sm font-medium"
              onClick={() => onAsk(t(key))}
            >
              {t(key)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ask({ profile }: { profile: Profile }) {
  const { t, lang, demo } = useApp();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const active = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const busy = exchanges.at(-1)?.state === "streaming";
  const dictation = useDictation(lang, (text) => setDraft(text.slice(0, MAX_CHARS)));
  const voice = useReadAloud(lang);

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
    dictation.stop();
    voice.stop();
    const id = nextId.current++;
    const turns = history(exchanges, question);
    const patch = (change: (x: Exchange) => Exchange) =>
      setExchanges((xs) => xs.map((x) => (x.id === id ? change(x) : x)));
    setExchanges((xs) => [...xs, asked(id, question)]);
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
  const onAsk = (question: string) => void ask(question);

  return (
    <div className="max-w-3xl">
      <h1 className="num text-5xl leading-tight">{t("ask.title")}</h1>
      <p className="mt-3 max-w-prose text-muted">{t("ask.lead", { place: profile.place.name })}</p>

      {exchanges.length > 0 && (
        <div className="mt-10 border-b border-line">
          {exchanges.map((x) => (
            <ExchangeView key={x.id} x={x} voice={voice} />
          ))}
        </div>
      )}

      <QuestionForm
        draft={draft}
        busy={busy}
        dictation={dictation}
        onDraft={setDraft}
        onAsk={onAsk}
      />

      {exchanges.length === 0 && <Suggestions onAsk={onAsk} />}

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
