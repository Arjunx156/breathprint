import type { Scale } from "@shared/aqi";
import { today } from "@shared/engine";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useApp } from "../../app/state";
import { type Air, AirPage } from "../../components/AirPage";
import { clockIn, localDay } from "../../lib/format";
import { PlanSection } from "../plan/PlanSection";
import { PersonalNotice } from "./PersonalNotice";
import { Reading } from "./Reading";
import { Ribbon } from "./Ribbon";
import { usePersonalPlan } from "./usePersonalPlan";

function Day({ profile, summary, offline }: Air) {
  const { t, lang, demo, saveProfile } = useApp();
  const ctx = useMemo(() => ({ profile, air: summary }), [profile, summary]);
  const { ranked, plan } = useMemo(() => today(ctx, lang), [ctx, lang]);
  const personal = usePersonalPlan(profile, lang, demo);
  // Remembers which reply was chosen, so a new one never swaps in unasked.
  const [chosen, setChosen] = useState<string | null>(null);
  const showing = personal.status === "ready" && personal.key === chosen;
  const shown = showing ? personal.reply.plan : plan;
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
            {shown.headline}
          </h1>
        </div>
        <div className="lg:pt-8">
          <Ribbon summary={summary} scale={profile.scale} />
        </div>
      </div>

      <PlanSection
        ctx={ctx}
        ranked={ranked}
        plan={shown}
        notice={
          <PersonalNotice
            state={personal}
            showing={showing}
            onShow={() => personal.status === "ready" && setChosen(personal.key)}
            onHide={() => setChosen(null)}
            onEnable={() => saveProfile({ ...profile, ai: true })}
          />
        }
      />
    </>
  );
}

export function TodayPage() {
  return <AirPage page={Day} />;
}
