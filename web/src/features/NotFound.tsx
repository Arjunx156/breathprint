import { Link } from "wouter";
import { useApp } from "../app/state";

/** The page for a path the app doesn't have, with one way home. */
export function NotFound() {
  const { t } = useApp();
  return (
    <div className="max-w-xl py-16">
      <p className="num text-8xl leading-none text-muted" aria-hidden="true">
        404
      </p>
      <h1 className="num mt-6 text-4xl leading-tight sm:text-5xl">{t("notFound.title")}</h1>
      <p className="mt-4 text-muted">{t("notFound.body")}</p>
      <Link href="/" className="btn btn-primary mt-8">
        {t("notFound.home")}
      </Link>
    </div>
  );
}
