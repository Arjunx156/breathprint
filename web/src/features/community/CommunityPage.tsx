import type { AirSummary } from "@shared/air";
import { collective, templateAdvisory } from "@shared/community";
import type { Profile } from "@shared/profile";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Redirect } from "wouter";
import { useApp } from "../../app/state";
import { AirFailed, AirWaiting } from "../../components/AirStatus";
import { useLanguageReady } from "../../lib/hindi";
import { useAir } from "../../lib/useAir";
import { AdvisoryForm, type Form } from "./AdvisoryForm";
import { fetchAdvisory, householdsOf, type Inputs, sameInputs, type Written } from "./advisory";
import { Paper } from "./Paper";

const NOTE = {
  model: "community.written",
  recorded: "community.recorded",
  fallback: "community.fallback",
  template: "community.draft",
} as const;

function Community({ profile, summary }: { profile: Profile; summary: AirSummary }) {
  const { t, lang: uiLang, demo } = useApp();
  const [form, setForm] = useState<Form>({
    audience: "society",
    channel: "whatsapp",
    rawHouseholds: "120",
    lang: uiLang,
  });
  // An English page can still write a Hindi advisory; its strings load on the way.
  useLanguageReady(form.lang);
  const [invalid, setInvalid] = useState(false);
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState<Written | null>(null);
  const active = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { audience, channel, lang } = form;
  const households = householdsOf(form.rawHouseholds);

  useEffect(() => () => active.current?.abort(), []);

  const change = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (patch.rawHouseholds !== undefined && householdsOf(patch.rawHouseholds) !== null)
      setInvalid(false);
  };

  // Breathprint's own advisory follows the form as it changes; Gemini's
  // stays only while it still matches what was asked for.
  const draft = useMemo<Written>(() => {
    const n = households ?? 1;
    return {
      audience,
      channel,
      households: n,
      lang,
      advisory: templateAdvisory(lang, summary, profile.place, profile.scale, audience),
      collective: households ? collective(summary, profile.place, audience, n) : null,
      by: "template",
    };
  }, [audience, channel, households, lang, summary, profile]);
  const current = written && sameInputs(written, draft) ? written : draft;

  const write = (e: FormEvent) => {
    e.preventDefault();
    if (households === null) return setInvalid(true);
    setInvalid(false);
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const inputs: Inputs = { audience, channel, households, lang };
    setWriting(true);
    // Settles into an advisory either way, so nothing is left to await.
    void fetchAdvisory({ ...inputs, place: profile.place, demo }, controller.signal)
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
        if (controller.signal.aborted) return;
        setWritten(result);
        setWriting(false);
        heading.current?.focus();
      });
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
          writing={writing}
          onChange={change}
          onSubmit={write}
        />

        <div>
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
              <p>{t(NOTE[current.by])}</p>
            )}
          </div>
          <Paper written={current} summary={summary} profile={profile} headingRef={heading} />
        </div>
      </div>
    </div>
  );
}

function CommunityFor({ profile }: { profile: Profile }) {
  const { demo } = useApp();
  const air = useAir(profile.place, demo);
  if (air.status === "loading") return <AirWaiting place={profile.place.name} />;
  if (air.status === "error") return <AirFailed retry={air.retry} />;
  return <Community profile={profile} summary={air.summary} />;
}

export default function CommunityPage() {
  const { profile } = useApp();
  if (!profile) return <Redirect to="/setup" replace />;
  return <CommunityFor profile={profile} />;
}
