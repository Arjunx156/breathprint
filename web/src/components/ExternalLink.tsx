import type { ReactNode } from "react";
import { useApp } from "../app/state";

/** A link that leaves Breathprint: it opens a new tab, and tells screen readers so. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const { t } = useApp();
  return (
    <a className="link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> {t("ui.newTab")}</span>
    </a>
  );
}
