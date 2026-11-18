import type { AirSummary } from "@shared/air";
import {
  type Advisory,
  AUDIENCES,
  type Audience,
  basisKm,
  CHANNELS,
  type Channel,
  type Collective,
  collective,
  templateAdvisory,
} from "@shared/community";
import { short } from "@shared/format";
import { t as translate } from "@shared/i18n";
import { coarse, GRID_KM, LANGUAGES, type Language, type Profile } from "@shared/profile";
import { type AdvisoryReply, AdvisoryReplySchema } from "@shared/replies";
import { type FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Redirect } from "wouter";
import { useApp } from "../../app/state";
import { AirFailed, AirWaiting } from "../../components/AirStatus";
import { Choice, TextField } from "../../components/fields";
import { client, failure } from "../../lib/api";
import { localDay } from "../../lib/format";
import { useLanguageReady } from "../../lib/hindi";
import { useAir } from "../../lib/useAir";

type Inputs = { audience: Audience; channel: Channel; households: number; lang: Language };
type Written = Inputs & {
  advisory: Advisory;
  collective: Collective | null;
  /** Gemini, a saved demo reply, Breathprint's own after Gemini failed, or the live draft. */
  by: "model" | "recorded" | "fallback" | "template";
};

const NOTE = {
  model: "community.written",
  recorded: "community.recorded",
  fallback: "community.fallback",
  template: "community.draft",
} as const;

const MAX_HOUSEHOLDS = 10_000;

/** Sends only the area, rounded to the forecast grid; no household goes with it. */
async function fetchAdvisory(
  input: Inputs & { place: Profile["place"]; demo: boolean },
  signal: AbortSignal,
): Promise<AdvisoryReply> {
  const place = { ...input.place, lat: coarse(input.place.lat), lon: coarse(input.place.lon) };
  const res = await client.api.advisory.$post({ json: { ...input, place } }, { init: { signal } });
  if (!res.ok) throw await failure(res);
  return AdvisoryReplySchema.parse(await res.json());
}

function householdsOf(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_HOUSEHOLDS ? n : null;
}

const same = (a: Inputs, b: Inputs) =>
  a.audience === b.audience &&
  a.channel === b.channel &&
  a.households === b.households &&
  a.lang === b.lang;

function togetherLine(lang: Language, c: Collective, audience: Audience): string | null {
  const vars = {
    n: c.households.toLocaleString("en-IN"),
    how: translate(lang, `community.how.${audience}`),
  };
  if (c.co2kg && c.pm25g)
    return translate(lang, "community.together", {
      ...vars,
      co2: short(c.co2kg.mid),
      pm: short(c.pm25g.mid),
    });
  if (c.co2kg)
    return translate(lang, "community.togetherCo2", { ...vars, co2: short(c.co2kg.mid) });
  if (c.pm25g) return translate(lang, "community.togetherPm", { ...vars, pm: short(c.pm25g.mid) });
  return null;
}

/** The advisory as plain text, laid out to survive a paste into WhatsApp or an email. */
function plainText(w: Written, together: string | null, source: string): string {
  const say = (key: "community.do" | "community.avoid" | "community.sensitive") =>
    translate(w.lang, key);
  const a = w.advisory;
  return [
    a.headline,
    "",
    a.situation,
    "",
    `${say("community.do")}:`,
    ...a.do.map((x) => `- ${x}`),
    "",
    `${say("community.avoid")}:`,
    ...a.avoid.map((x) => `- ${x}`),
    "",
    `${say("community.sensitive")}: ${a.sensitive}`,
    ...(together ? ["", together] : []),
    "",
    source,
  ].join("\n");
}

function Paper({
  written,
  summary,
  profile,
  headingRef,
}: {
  written: Written;
  summary: AirSummary;
  profile: Profile;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const lang = written.lang;
  const a = written.advisory;
  const together = written.collective
    ? togetherLine(lang, written.collective, written.audience)
    : null;
  const km = basisKm(profile.place, written.audience);
  const source = translate(lang, "community.source", { date: localDay(summary.now, lang) });

  return (
    <article
      lang={lang}
      className="rounded-2xl bg-surface p-6 ring-1 ring-line sm:p-10 print:p-0 print:ring-0"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="num text-[2rem] leading-[1.1] outline-offset-4 sm:text-[2.5rem]"
      >
        {a.headline}
      </h2>
      <p className="mt-4 max-w-prose text-lg">{a.situation}</p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h3 className="font-semibold">{translate(lang, "community.do")}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-muted">
            {a.do.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-semibold">{translate(lang, "community.avoid")}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-muted">
            {a.avoid.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-8">
        <h3 className="font-semibold">{translate(lang, "community.sensitive")}</h3>
        <p className="mt-2 max-w-prose">{a.sensitive}</p>
      </section>

      {together && (
        <section className="mt-8 border-t border-line pt-6">
          <h3 className="font-semibold">{translate(lang, "community.togetherTitle")}</h3>
          <p className="num mt-2 max-w-[34ch] text-2xl leading-snug">{together}</p>
          <p className="mt-3 max-w-prose text-sm text-muted">
            {translate(lang, `community.basis.${written.audience}`, { km: km ?? 0 })}{" "}
            {translate(lang, "community.honest")}
          </p>
        </section>
      )}

      <p className="mt-8 text-sm text-muted">{source}</p>
      <ShareButtons text={plainText(written, together, source)} />
    </article>
  );
}

function ShareButtons({ text }: { text: string }) {
  const { t } = useApp();
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    void text; // New words, so the old "Copied" no longer holds.
    setCopied("idle");
  }, [text]);

  const copy = () =>
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied("done"))
      .catch(() => setCopied("failed"));

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 print:hidden">
      <button type="button" className="btn btn-primary" onClick={copy}>
        {t("community.copy")}
      </button>
      <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
        {t("community.print")}
      </button>
      <p role="status" className="text-sm text-muted">
        {copied === "done" && t("community.copied")}
        {copied === "failed" && t("community.copyFailed")}
      </p>
    </div>
  );
}

function Community({ profile, summary }: { profile: Profile; summary: AirSummary }) {
  const { t, lang: uiLang, demo } = useApp();
  const [audience, setAudience] = useState<Audience>("society");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [rawHouseholds, setRawHouseholds] = useState("120");
  const [lang, setLang] = useState<Language>(uiLang);
  // An English page can still write a Hindi advisory; its strings load on the way.
  useLanguageReady(lang);
  const [invalid, setInvalid] = useState(false);
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState<Written | null>(null);
  const active = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const households = householdsOf(rawHouseholds);

  useEffect(() => () => active.current?.abort(), []);

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
  const current = written && same(written, draft) ? written : draft;

  const write = (e: FormEvent) => {
    e.preventDefault();
    if (households === null) return setInvalid(true);
    setInvalid(false);
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const inputs: Inputs = { audience, channel, households, lang };
    setWriting(true);
    fetchAdvisory({ ...inputs, place: profile.place, demo }, controller.signal)
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
        <form onSubmit={write} className="space-y-7 print:hidden" noValidate>
          <Choice
            legend={t("community.audience")}
            options={AUDIENCES}
            value={audience}
            label={(v) => t(`audience.${v}`)}
            onChange={setAudience}
          />
          <TextField
            label={t("community.households")}
            hint={t("community.householdsHint")}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_HOUSEHOLDS}
            step={1}
            value={rawHouseholds}
            onChange={(v) => {
              setRawHouseholds(v);
              if (householdsOf(v) !== null) setInvalid(false);
            }}
            error={invalid ? t("community.householdsInvalid") : null}
          />
          <Choice
            legend={t("community.channel")}
            options={CHANNELS}
            value={channel}
            label={(v) => t(`channel.${v}`)}
            onChange={setChannel}
          />
          <Choice
            legend={t("community.language")}
            options={LANGUAGES}
            value={lang}
            label={(v) => t(`language.${v}`)}
            onChange={setLang}
          />
          <div className="border-t border-line pt-6">
            <button type="submit" className="btn btn-primary" disabled={writing}>
              {t("community.submit")}
            </button>
            <p className="mt-3 text-sm text-muted">{t("community.privacy", { km: GRID_KM })}</p>
          </div>
        </form>

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
