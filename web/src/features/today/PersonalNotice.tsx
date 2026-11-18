import { GRID_KM } from "@shared/profile";
import { useRef } from "react";
import { useApp } from "../../app/state";
import type { PersonalPlan } from "./usePersonalPlan";

type Props = {
  state: PersonalPlan;
  showing: boolean;
  onShow: () => void;
  onHide: () => void;
  onEnable: () => void;
};

/** Gemini's plan has arrived: offer it, or the way back to the rules once it shows. */
function Ready({
  recorded,
  showing,
  onShow,
  onHide,
}: Pick<Props, "showing" | "onShow" | "onHide"> & { recorded: boolean }) {
  const { t } = useApp();
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-l-2 border-accent pl-4">
      <div className="max-w-prose">
        <p>{showing ? t("ai.showing") : t("ai.ready")}</p>
        {showing && recorded && <p className="mt-1 text-sm text-muted">{t("ai.recorded")}</p>}
      </div>
      {/* One button that changes its words, so focus stays put after a press. */}
      <button
        type="button"
        className={showing ? "btn btn-quiet" : "btn btn-primary"}
        onClick={showing ? onHide : onShow}
      >
        {showing ? t("ai.back") : t("ai.show")}
      </button>
    </div>
  );
}

/**
 * Where Gemini's plan is offered. It never replaces the plan on its own: the
 * family chooses to see it, and can always go back to the rules.
 */
export function PersonalNotice({ state, showing, onShow, onHide, onEnable }: Props) {
  const { t } = useApp();
  const region = useRef<HTMLDivElement>(null);
  // The pressed button leaves with the state it belonged to; the notice keeps focus instead.
  const thenStay = (act: () => void) => () => {
    act();
    region.current?.focus();
  };

  const body = () => {
    switch (state.status) {
      case "off":
        return (
          <div className="border-l-2 border-accent pl-4">
            <p>{t("ai.invite")}</p>
            <p className="mt-1 text-sm text-muted">{t("ai.privacy", { km: GRID_KM })}</p>
            <button type="button" className="btn btn-quiet mt-4" onClick={thenStay(onEnable)}>
              {t("ai.enable")}
            </button>
          </div>
        );
      case "loading":
        return (
          <p className="flex items-center gap-3 text-muted">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse"
            />
            {t("ai.loading")}
          </p>
        );
      case "ready":
        return (
          <Ready
            recorded={state.reply.recorded}
            showing={showing}
            onShow={onShow}
            onHide={onHide}
          />
        );
      case "failed":
        return (
          <div className="flex flex-wrap items-center gap-x-4">
            <p className="text-muted">{t("ai.failed")}</p>
            <button
              type="button"
              className="link min-h-11 font-medium"
              onClick={thenStay(state.retry)}
            >
              {t("ai.retry")}
            </button>
          </div>
        );
    }
  };

  return (
    <div ref={region} tabIndex={-1} aria-live="polite" className="mt-6 outline-offset-4">
      {body()}
    </div>
  );
}
