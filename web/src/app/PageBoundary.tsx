import { Component, type ReactNode } from "react";
import { useApp } from "./state";

/** While a page's code is on its way: a quiet shape, and words for screen readers. */
export function PageLoading() {
  const { t } = useApp();
  return (
    <div role="status" className="py-10">
      <span className="sr-only">{t("ui.loading")}</span>
      <div aria-hidden="true" className="h-40 max-w-3xl animate-pulse rounded-xl bg-line/50" />
    </div>
  );
}

function PageFailed() {
  const { t } = useApp();
  return (
    <div role="alert" className="max-w-prose py-10">
      <h1 className="num text-4xl leading-tight">{t("ui.pageFailed")}</h1>
      <p className="mt-3 text-muted">{t("ui.pageFailedLead")}</p>
      <button type="button" className="btn btn-primary mt-6" onClick={() => location.reload()}>
        {t("ui.retry")}
      </button>
    </div>
  );
}

/** A page whose code can't arrive, say offline on a first visit, says so instead of blanking the app. */
export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? <PageFailed /> : this.props.children;
  }
}
