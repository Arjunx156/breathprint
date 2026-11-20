import type { MessageKey } from "@shared/i18n";
import { Link, useLocation } from "wouter";
import { ExternalLink } from "../components/ExternalLink";
import { useApp } from "./state";

const NAV: readonly { href: string; label: MessageKey }[] = [
  { href: "/", label: "nav.today" },
  { href: "/ask", label: "nav.ask" },
  { href: "/indoors", label: "nav.indoors" },
  { href: "/community", label: "nav.community" },
  { href: "/settings", label: "nav.settings" },
];

/** The first thing a keyboard reaches: a jump past the header to the page itself. */
export function SkipLink() {
  const { t } = useApp();
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      {t("ui.skip")}
    </a>
  );
}

function Nav() {
  const { t } = useApp();
  const [path] = useLocation();
  return (
    <nav aria-label={t("nav.label")}>
      <ul className="-mx-3 flex flex-wrap items-center sm:mx-0 sm:gap-1">
        {NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={path === item.href ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium sm:px-3.5 text-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
            >
              {t(item.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The name, which leads home, and the five pages. */
export function Header() {
  const { t } = useApp();
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 px-5 py-3 sm:px-8 print:hidden">
      <Link href="/" className="num text-[1.75rem] leading-none">
        {t("app.name")}
      </Link>
      <Nav />
    </header>
  );
}

/** Says the household on screen is the demo's, with a way back to your own. */
export function DemoBanner() {
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

/** Where the data comes from, what stays private, and who made it. */
export function Footer() {
  const { t } = useApp();
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto grid max-w-6xl gap-2 px-5 py-10 text-sm text-muted sm:px-8 md:grid-cols-[1fr_auto] md:gap-8">
        <div className="space-y-1">
          <p>
            {t("footer.data")}{" "}
            <ExternalLink href="https://open-meteo.com/">Open-Meteo</ExternalLink>,{" "}
            <ExternalLink href="https://atmosphere.copernicus.eu/">Copernicus CAMS</ExternalLink>
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
