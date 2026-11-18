import { forModel, GRID_KM, LANGUAGES } from "@shared/profile";
import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useApp } from "../../app/state";
import { Choice, Toggle } from "../../components/fields";

const SCALES = ["IN", "US"] as const;

/**
 * Forgetting asks first. The question takes focus on its safe answer, so a
 * second press of Enter keeps the household; backing out returns focus to
 * the button that asked.
 */
function Forget() {
  const { t, forget } = useApp();
  const [, navigate] = useLocation();
  const [asking, setAsking] = useState(false);
  const ask = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const changed = useRef(false);

  useEffect(() => {
    if (!changed.current) return;
    (asking ? keep : ask).current?.focus();
  }, [asking]);

  const choose = (next: boolean) => {
    changed.current = true;
    setAsking(next);
  };

  if (!asking)
    return (
      <button ref={ask} type="button" className="btn btn-quiet" onClick={() => choose(true)}>
        {t("settings.forget")}
      </button>
    );
  return (
    <div role="alert" className="border-l-2 border-[var(--lvl-4)] pl-4">
      <p>{t("settings.forgetConfirm")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            forget();
            navigate("/setup");
          }}
        >
          {t("settings.forgetYes")}
        </button>
        <button ref={keep} type="button" className="btn btn-quiet" onClick={() => choose(false)}>
          {t("settings.cancel")}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, profile, demo, saveProfile, exitDemo } = useApp();
  if (!profile) return <Redirect to="/setup" replace />;

  return (
    <div className="max-w-2xl">
      <h1 className="num text-5xl leading-tight">{t("settings.title")}</h1>

      <div className="mt-10 space-y-8">
        <Choice
          legend={t("setup.language")}
          options={LANGUAGES}
          value={profile.language}
          label={(v) => t(`language.${v}`)}
          onChange={(language) => saveProfile({ ...profile, language })}
        />
        <Choice
          legend={t("setup.scale")}
          options={SCALES}
          value={profile.scale}
          label={(v) => t(`scale.${v}`)}
          onChange={(scale) => saveProfile({ ...profile, scale })}
        />
        <Toggle
          label={t("settings.ai")}
          checked={profile.ai}
          onChange={(ai) => saveProfile({ ...profile, ai })}
          hint={t("ai.privacy", { km: GRID_KM })}
        />
        <Link href="/setup" className="btn btn-quiet">
          {t("settings.edit")}
        </Link>
      </div>

      <section aria-labelledby="knows" className="mt-16">
        <h2 id="knows" className="text-2xl font-semibold">
          {t("settings.knows")}
        </h2>
        <p className="mt-2 max-w-prose text-muted">{t("settings.knowsIntro")}</p>
        <pre className="mt-4 rounded-xl bg-surface p-4 text-xs leading-relaxed whitespace-pre-wrap ring-1 ring-line [overflow-wrap:anywhere]">
          {JSON.stringify(forModel(profile), null, 2)}
        </pre>
      </section>

      <section className="mt-16 border-t border-line pt-8">
        {demo ? (
          <button type="button" className="btn btn-quiet" onClick={exitDemo}>
            {t("demo.exit")}
          </button>
        ) : (
          <Forget />
        )}
      </section>
    </div>
  );
}
