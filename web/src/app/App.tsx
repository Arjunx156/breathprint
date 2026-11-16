import type { MessageKey } from "@shared/i18n";
import { lazy, Suspense } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { NotFound } from "../features/NotFound";
import { TodayPage } from "../features/today/TodayPage";
import { useApp } from "./state";

// Setup and settings are visited once in a while; Today loads without them.
const SetupPage = lazy(() => import("../features/setup/SetupPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

const NAV: readonly { href: string; label: MessageKey }[] = [
  { href: "/", label: "nav.today" },
  { href: "/settings", label: "nav.settings" },
];

function Nav() {
  const { t } = useApp();
  const [path] = useLocation();
  return (
    <nav aria-label={t("nav.label")}>
      <ul className="flex items-center gap-1">
        {NAV.map((item) => {
          const current = path === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
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

function DemoBanner() {
  const { t, exitDemo } = useApp();
  return (
    <div className="border-b border-line bg-surface">
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
    <footer className="border-t border-line">
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
        <p className="md:self-end">{t("footer.by")}</p>
      </div>
    </footer>
  );
}

export function App() {
  const { t, demo } = useApp();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("ui.skip")}
      </a>
      {demo && <DemoBanner />}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="num text-[1.75rem] leading-none">
          {t("app.name")}
        </Link>
        <Nav />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-24 outline-none sm:px-8 sm:pt-10"
      >
        <Suspense fallback={null}>
          <Switch>
            <Route path="/" component={TodayPage} />
            <Route path="/setup" component={SetupPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
