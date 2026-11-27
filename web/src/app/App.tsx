import { lazy, Suspense, useRef } from "react";
import { Route, Switch, useLocation } from "wouter";
import { NotFound } from "../features/NotFound";
import { TodayPage } from "../features/today/TodayPage";
import { Footer, Header, SkipLink } from "./Frame";
import { PageBoundary, PageLoading } from "./PageBoundary";
import { useApp } from "./state";
import { usePageChange } from "./usePageChange";

// Today loads alone; every other page, and the knowledge library Ask carries, comes when visited.
const SetupPage = lazy(() => import("../features/setup/SetupPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const AskPage = lazy(() => import("../features/ask/AskPage"));
const CommunityPage = lazy(() => import("../features/community/CommunityPage"));
const IndoorsPage = lazy(() => import("../features/indoors/IndoorsPage"));

function Pages() {
  return (
    <Switch>
      <Route path="/" component={TodayPage} />
      <Route path="/setup" component={SetupPage} />
      <Route path="/ask" component={AskPage} />
      <Route path="/indoors" component={IndoorsPage} />
      <Route path="/community" component={CommunityPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

/** The page frame: skip link, header, the routed page and the footer. */
export function App() {
  const { t } = useApp();
  const [path] = useLocation();
  const main = useRef<HTMLElement>(null);
  usePageChange(path, t, main);
  return (
    <>
      <SkipLink />
      <Header />
      {/* A screen tall at least, so the footer starts below the fold and a page
          that grows as its code and forecast arrive never pushes it across the screen. */}
      <main
        ref={main}
        id="main"
        tabIndex={-1}
        className="mx-auto min-h-dvh w-full max-w-6xl px-5 pt-6 pb-24 outline-none sm:px-8 sm:pt-10"
      >
        <PageBoundary key={path}>
          <Suspense fallback={<PageLoading />}>
            <Pages />
          </Suspense>
        </PageBoundary>
      </main>
      <Footer />
    </>
  );
}
