import type { AirSummary } from "@shared/air";
import type { Scale } from "@shared/aqi";
import { THRESHOLDS } from "@shared/factors";
import { useApp } from "../../app/state";
import { Choice } from "../../components/fields";
import { LevelMark } from "../../components/LevelMark";

const SCALES: readonly Scale[] = ["IN", "US"];

type Props = { summary: AirSummary; scale: Scale; onScale: (scale: Scale) => void };

/** The day's headline number, said three ways: a number, a word and a shape. */
export function Reading({ summary, scale, onScale }: Props) {
  const { t, tx } = useApp();
  const reading = summary.current.aqi[scale];
  const pm = Math.round(summary.current.pm25);
  const times = Math.round(pm / THRESHOLDS.whoDaily);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="num text-[clamp(5.5rem,24vw,9.5rem)] leading-[0.8]">
          {reading.value}
          <span className="sr-only"> {t(`scale.${scale}`)}</span>
        </p>
        <div className="pb-1.5">
          <p className="text-2xl font-semibold leading-tight">
            {tx(`aqi.${scale}.${reading.category}`)}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted">
            <LevelMark
              level={reading.level}
              label={t("today.level", { level: reading.level + 1 })}
            />
            <span aria-hidden="true">{t(`scale.${scale}`)}</span>
          </div>
        </div>
      </div>
      <p className="mt-6 max-w-prose">
        {pm > THRESHOLDS.whoDaily
          ? t("today.pm25Over", { pm25: pm, times })
          : t("today.pm25Under", { pm25: pm })}
      </p>
      <div className="mt-4">
        <Choice
          legend={t("setup.scale")}
          options={SCALES}
          value={scale}
          label={(s) => t(`scale.${s}`)}
          onChange={onScale}
          hideLegend
        />
      </div>
    </div>
  );
}
