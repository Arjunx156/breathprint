import type { MessageKey } from "@shared/i18n";
import { Component, lazy, type ReactNode, Suspense, useRef } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { NotFound } from "../features/NotFound";
import { TodayPage } from "../features/today/TodayPage";
import { useApp } from "./state";
import { usePageChange } from "./usePageChange";

// Today loads alone; every other page, and the knowledge library Ask carries, comes when visited.
const SetupPage = lazy(() => import("../features/setup/SetupPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const AskPage = lazy(() => import("../features/ask/AskPage"));
const CommunityPage = lazy(() => import("../features/community/CommunityPage"));
const IndoorsPage = lazy(() => import("../features/indoors/IndoorsPage"));

const NAV: readonly { href: string; label: MessageKey }[] = [
  { href: "/", label: "nav.today" },
  { href: "/ask", label: "nav.ask" },
  { href: "/indoors", label: "nav.indoors" },
  { href: "/community", label: "nav.community" },
  { href: "/settings", label: "nav.settings" },
];

function Nav() {
  const { t } = useApp();
  const [path] = useLocation();
  return (
    <nav aria-label={t("nav.label")}>
      <ul className="-mx-3 flex flex-wrap items-center sm:mx-0 sm:gap-1">
        {NAV.map((item) => {
          const current = path === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium sm:px-3.5 text-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** While a page's code is on its way: a quiet shape, and words for screen readers. */
function PageLoading() {
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

function DemoBanner() {
  const { t, exitDemo } = useApp();
  return (
    <div className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 text-sm sm:px-8">
        <p>{t("demo.banner")}</p>
        <button type="button" onClick={exitDemo} className="link min-h-11 font-medium">
          {t("demo.exit")}
        </button>
      </div>
    </div>
  );
}

function Footer() {
  const { t } = useApp();
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto grid max-w-6xl gap-2 px-5 py-10 text-sm text-muted sm:px-8 md:grid-cols-[1fr_auto] md:gap-8">
        <div className="space-y-1">
          <p>
            {t("footer.data")}{" "}
            <a
              className="link"
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open-Meteo
            </a>
            ,{" "}
            <a
              className="link"
              href="https://atmosphere.copernicus.eu/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Copernicus CAMS
            </a>
          </p>
          <p>{t("footer.privacy")}</p>
        </div>
        <p className="md:self-end">
          {t("footer.by")} ·{" "}
          <a className="link" href="/blog/">
            {t("footer.blog")}
          </a>
        </p>
      </div>
    </footer>
  );
}

export function App() {
  const { t, demo } = useApp();
  const [path] = useLocation();
  const main = useRef<HTMLElement>(null);
  usePageChange(path, t, main);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("ui.skip")}
      </a>
      {demo && <DemoBanner />}
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 px-5 py-3 sm:px-8 print:hidden">
        <Link href="/" className="num text-[1.75rem] leading-none">
          {t("app.name")}
        </Link>
        <Nav />
      </header>
      <main
        ref={main}
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-24 outline-none sm:px-8 sm:pt-10"
      >
        <PageBoundary key={path}>
          <Suspense fallback={<PageLoading />}>
            <Switch>
              <Route path="/" component={TodayPage} />
              <Route path="/setup" component={SetupPage} />
              <Route path="/ask" component={AskPage} />
              <Route path="/indoors" component={IndoorsPage} />
              <Route path="/community" component={CommunityPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </PageBoundary>
      </main>
      <Footer />
    </div>
  );
}
