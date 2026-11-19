import type { AirSummary } from "@shared/air";
import type { Profile } from "@shared/profile";
import type { ComponentType } from "react";
import { Redirect } from "wouter";
import { useApp } from "../app/state";
import { useAir } from "../lib/useAir";

/** What a page gets once the household is set up and its forecast is here. */
export type Air = { profile: Profile; summary: AirSummary; offline: boolean };

/** While the forecast for a place is on its way. */
function AirWaiting({ place }: { place: string }) {
  const { t } = useApp();
  return (
    <div role="status" className="py-10">
      <p className="text-muted">{t("air.loading", { place })}</p>
      <div className="mt-8 h-40 max-w-3xl animate-pulse rounded-xl bg-line/50" aria-hidden="true" />
    </div>
  );
}

/** When no forecast came and none was saved on this device. */
function AirFailed({ retry }: { retry: () => void }) {
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

/** A page built on the household's air: setup comes first, then the forecast, then the page. */
export function AirPage({ page: Page }: { page: ComponentType<Air> }) {
  const { profile, demo } = useApp();
  const air = useAir(profile?.place ?? null, demo);
  if (!profile) return <Redirect to="/setup" replace />;
  if (air.status === "loading") return <AirWaiting place={profile.place.name} />;
  if (air.status === "error") return <AirFailed retry={air.retry} />;
  return <Page profile={profile} summary={air.summary} offline={air.offline} />;
}
