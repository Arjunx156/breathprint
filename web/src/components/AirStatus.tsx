import { useApp } from "../app/state";

/** While the forecast for a place is on its way. */
export function AirWaiting({ place }: { place: string }) {
  const { t } = useApp();
  return (
    <div role="status" className="py-10">
      <p className="text-muted">{t("air.loading", { place })}</p>
      <div className="mt-8 h-40 max-w-3xl animate-pulse rounded-xl bg-line/50" aria-hidden="true" />
    </div>
  );
}

/** When no forecast came and none was saved on this device. */
export function AirFailed({ retry }: { retry: () => void }) {
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
