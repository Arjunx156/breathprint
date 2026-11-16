import type { AirSummary } from "@shared/air";
import type { Scale } from "@shared/aqi";
import { today } from "@shared/engine";
import type { Profile } from "@shared/profile";
import { useMemo } from "react";
import { Link, Redirect } from "wouter";
import { useApp } from "../../app/state";
import { clockIn, localDay } from "../../lib/format";
import { useAir } from "../../lib/useAir";
import { PlanSection } from "../plan/PlanSection";
import { Reading } from "./Reading";
import { Ribbon } from "./Ribbon";

function Day({
  profile,
  summary,
  offline,
}: {
  profile: Profile;
  summary: AirSummary;
  offline: boolean;
}) {
  const { t, lang, saveProfile } = useApp();
  const ctx = useMemo(() => ({ profile, air: summary }), [profile, summary]);
  const { ranked, plan } = useMemo(() => today(ctx, lang), [ctx, lang]);
  const setScale = (scale: Scale) => saveProfile({ ...profile, scale });

  return (
    <>
      <p className="text-muted">
        {t("today.place", { place: profile.place.name, time: localDay(summary.now, lang) })}
        <span aria-hidden="true"> · </span>
        <Link href="/setup" className="link">
          {t("today.change")}
        </Link>
      </p>
      {offline && (
        <p role="status" className="mt-3 border-l-2 border-accent pl-3 text-sm">
          {t("air.saved", { time: clockIn(summary.fetchedAt, summary.timezone) })}
        </p>
      )}

      <div className="mt-8 grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
        <div>
          <Reading summary={summary} scale={profile.scale} onScale={setScale} />
          <h1 className="num mt-10 max-w-[22ch] text-[2rem] leading-[1.12] sm:text-[2.5rem]">
            {plan.headline}
          </h1>
        </div>
        <div className="lg:pt-8">
          <Ribbon summary={summary} scale={profile.scale} />
        </div>
      </div>

      <PlanSection
        key={plan.steps.map((s) => s.actionId).join()}
        ctx={ctx}
        ranked={ranked}
        plan={plan}
      />
    </>
  );
}

function Waiting({ place }: { place: string }) {
  const { t } = useApp();
  return (
    <div role="status" className="py-10">
      <p className="text-muted">{t("air.loading", { place })}</p>
      <div className="mt-8 h-40 max-w-3xl animate-pulse rounded-xl bg-line/50" aria-hidden="true" />
    </div>
  );
}

function Failed({ retry }: { retry: () => void }) {
  const { t } = useApp();
  return (
    <div role="alert" className="max-w-xl py-10">
      <h1 className="num text-4xl leading-tight">{t("air.error")}</h1>
      <button type="button" className="btn btn-primary mt-6" onClick={retry}>
        {t("air.retry")}
      </button>
    </div>
  );
}

function TodayFor({ profile }: { profile: Profile }) {
  const { demo } = useApp();
  const air = useAir(profile.place, demo);
  if (air.status === "loading") return <Waiting place={profile.place.name} />;
  if (air.status === "error") return <Failed retry={air.retry} />;
  return <Day profile={profile} summary={air.summary} offline={air.offline} />;
}

export function TodayPage() {
  const { profile } = useApp();
  if (!profile) return <Redirect to="/setup" replace />;
  return <TodayFor profile={profile} />;
}
