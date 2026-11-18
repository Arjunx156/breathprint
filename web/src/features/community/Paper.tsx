import type { AirSummary } from "@shared/air";
import { basisKm } from "@shared/community";
import { t as translate } from "@shared/i18n";
import type { Profile } from "@shared/profile";
import { type RefObject, useEffect, useState } from "react";
import { useApp } from "../../app/state";
import { localDay } from "../../lib/format";
import { plainText, togetherLine, type Written } from "./advisory";

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

/** The advisory as it will be shared, in its own language, ready to copy or print. */
export function Paper({
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
