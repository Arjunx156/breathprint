import type { Language, Place } from "@shared/profile";
import { type SubmitEvent, useMemo, useRef, useState } from "react";
import { useApp } from "../../app/state";
import { type Air, AirPage } from "../../components/AirPage";
import { useLanguageReady } from "../../lib/hindi";
import { useLatestRequest } from "../../lib/useLatestRequest";
import { AdvisoryForm, type Form } from "./AdvisoryForm";
import {
  draftOf,
  fetchAdvisory,
  householdsOf,
  type Inputs,
  sameInputs,
  type Written,
} from "./advisory";
import { Paper } from "./Paper";

const NOTE = {
  model: "community.written",
  recorded: "community.recorded",
  fallback: "community.fallback",
  template: "community.draft",
} as const;

/** The form opens on a WhatsApp message for a society of 120 households, in the page's language. */
function useAdvisoryForm(pageLang: Language) {
  const [form, setForm] = useState<Form>({
    audience: "society",
    channel: "whatsapp",
    rawHouseholds: "120",
    lang: pageLang,
  });
  const [invalid, setInvalid] = useState(false);
  // An English page can still write a Hindi advisory; its strings load on the way.
  useLanguageReady(form.lang);

  const change = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (patch.rawHouseholds !== undefined && householdsOf(patch.rawHouseholds) !== null)
      setInvalid(false);
  };
  return { form, invalid, setInvalid, change };
}

/** Asks Gemini to write the advisory; on any failure it settles into Breathprint's own words. */
function useWriter(place: Place, demo: boolean) {
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState<Written | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const start = useLatestRequest();

  const write = (inputs: Inputs, draft: Written) => {
    const signal = start();
    setWriting(true);
    // Settles into an advisory either way, so nothing is left to await.
    void fetchAdvisory({ ...inputs, place, demo }, signal)
      .then(
        (reply): Written => ({
          ...inputs,
          advisory: reply.advisory,
          collective: reply.collective,
          by: reply.recorded ? "recorded" : "model",
        }),
      )
      .catch((): Written => ({ ...draft, ...inputs, by: "fallback" }))
      .then((result) => {
        if (signal.aborted) return;
        setWritten(result);
        setWriting(false);
        heading.current?.focus();
      });
  };
  return { writing, written, write, heading };
}

/** Gemini at work, or whose words the advisory below is in. */
function WritingNote({ writing, by }: { writing: boolean; by: Written["by"] }) {
  const { t } = useApp();
  return (
    <div aria-live="polite" className="mb-4 min-h-6 text-sm text-muted print:hidden">
      {writing ? (
        <p className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse"
          />
          {t("community.writing")}
        </p>
      ) : (
        <p>{t(NOTE[by])}</p>
      )}
    </div>
  );
}

function Community({ profile, summary }: Air) {
  const { t, lang: pageLang, demo } = useApp();
  const { form, invalid, setInvalid, change } = useAdvisoryForm(pageLang);
  const writer = useWriter(profile.place, demo);
  const { audience, channel, lang } = form;
  const households = householdsOf(form.rawHouseholds);

  // Breathprint's own advisory follows the form as it changes; Gemini's
  // stays only while it still matches what was asked for.
  const draft = useMemo(
    () => draftOf({ audience, channel, lang, households }, summary, profile),
    [audience, channel, lang, households, summary, profile],
  );
  const current = writer.written && sameInputs(writer.written, draft) ? writer.written : draft;

  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    setInvalid(households === null);
    if (households !== null) writer.write({ audience, channel, households, lang }, draft);
  };

  return (
    <div>
      <div className="print:hidden">
        <h1 className="num max-w-[18ch] text-5xl leading-tight">{t("community.title")}</h1>
        <p className="mt-3 max-w-prose text-muted">
          {t("community.lead", { place: profile.place.name })}
        </p>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-16">
        <AdvisoryForm
          form={form}
          invalid={invalid}
          writing={writer.writing}
          onChange={change}
          onSubmit={submit}
        />
        <div>
          <WritingNote writing={writer.writing} by={current.by} />
          <Paper
            written={current}
            summary={summary}
            profile={profile}
            headingRef={writer.heading}
          />
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  return <AirPage page={Community} />;
}
