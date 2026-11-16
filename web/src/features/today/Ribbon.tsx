import { type AirSummary, clockOf, dayOf, hourOf } from "@shared/air";
import { aqi, type Scale } from "@shared/aqi";
import { THRESHOLDS } from "@shared/factors";
import { useId, useState } from "react";
import { useApp } from "../../app/state";
import { weekdayShort } from "../../lib/format";

/** A round ceiling for the chart, so the WHO line and the bars sit on a sensible scale. */
function ceiling(max: number): number {
  const step = max > 200 ? 100 : 50;
  return Math.max(100, Math.ceil(max / step) * step);
}

const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;

type Props = { summary: AirSummary; scale: Scale };

/**
 * The signature view: the next 48 hours as bars coloured by AQI level, with
 * the cleaner windows bracketed and the WHO guideline drawn across. A table
 * carries the same numbers for anyone who can't use the chart.
 */
export function Ribbon({ summary, scale }: Props) {
  const { t, tx, lang } = useApp();
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const series = summary.series;
  const n = series.length;
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) return null;

  const top = ceiling(Math.max(...series.map((h) => h.pm25 ?? 0)));
  const whoAt = (THRESHOLDS.whoDaily / top) * 100;
  const windows = summary.windows
    .map((w) => ({ w, i: series.findIndex((h) => h.time === w.start) }))
    .filter(({ i }) => i >= 0);
  const desc = t("today.ribbonDesc", {
    start: `${weekdayShort(first.time, lang)} ${clockOf(first.time)}`,
    end: `${weekdayShort(last.time, lang)} ${clockOf(last.time)}`,
  });

  return (
    <figure aria-labelledby={titleId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <figcaption id={titleId} className="text-lg font-semibold">
          {t("today.ribbonTitle")}
        </figcaption>
        <button
          type="button"
          className="link min-h-11 text-sm"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? t("today.asChart") : t("today.asTable")}
        </button>
      </div>

      {asTable ? (
        <div className="mt-3 rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">{desc}</caption>
            <thead className="sticky top-0 bg-surface text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("table.time")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("table.pm25")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("table.level")}
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((h) => (
                <tr key={h.time} className="border-t border-line">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {weekdayShort(h.time, lang)} {clockOf(h.time)}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {h.pm25 === null ? "–" : Math.round(h.pm25)}
                  </td>
                  <td className="px-3 py-1.5">
                    {h.pm25 === null
                      ? "–"
                      : tx(`aqi.${scale}.${aqi(scale, h.pm25, null).category}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={windows.length > 0 ? "mt-12" : "mt-4"}>
          <div className="relative h-36 sm:h-44" role="img" aria-label={desc}>
            <svg
              viewBox={`0 0 ${n} 100`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-hidden="true"
            >
              {windows.map(({ w, i }) => (
                <rect
                  key={w.start}
                  x={i}
                  y={0}
                  width={w.hours}
                  height={100}
                  fill="var(--accent)"
                  fillOpacity="0.08"
                />
              ))}
              {series.map((h, i) =>
                i > 0 && hourOf(h.time) === 0 ? (
                  <line
                    key={`d${h.time}`}
                    x1={i}
                    x2={i}
                    y1={0}
                    y2={100}
                    stroke="var(--line)"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null,
              )}
              {series.map((h, i) => {
                if (h.pm25 === null) return null;
                const height = Math.max(1.5, (h.pm25 / top) * 100);
                return (
                  <rect
                    key={h.time}
                    x={i + 0.14}
                    y={100 - height}
                    width={0.72}
                    height={height}
                    fill={`var(--lvl-${aqi(scale, h.pm25, null).level})`}
                  />
                );
              })}
              <line
                x1={0}
                x2={n}
                y1={100 - whoAt}
                y2={100 - whoAt}
                stroke="var(--ink)"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {windows.map(({ w, i }) => (
              <div
                key={w.start}
                aria-hidden="true"
                className="absolute -top-6 h-3 border-x border-t border-accent"
                style={{ left: pct(i, n), width: pct(w.hours, n) }}
              >
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-xs font-medium text-accent">
                  {t("today.window")}
                </span>
              </div>
            ))}
            <span
              aria-hidden="true"
              className="absolute right-0 translate-y-1/2 bg-bg pl-1 text-xs text-muted"
              style={{ bottom: `${whoAt}%` }}
            >
              {t("today.who")} {THRESHOLDS.whoDaily}
            </span>
          </div>
          <div className="relative mt-1.5 h-5 text-xs text-muted" aria-hidden="true">
            {series.map((h, i) => {
              const hour = hourOf(h.time);
              if (i === 0)
                return (
                  <span key={h.time} className="absolute left-0 font-medium text-ink">
                    {t("today.now")}
                  </span>
                );
              // Leave room for "Now" at the start and keep the last label inside the chart.
              if (hour % 6 !== 0 || i < 5 || i > n - 3) return null;
              return (
                <span
                  key={h.time}
                  className="absolute -translate-x-1/2"
                  style={{ left: pct(i, n) }}
                >
                  {hour === 0 ? weekdayShort(h.time, lang) : clockOf(h.time)}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <CleanWindow summary={summary} />
    </figure>
  );
}

function CleanWindow({ summary }: { summary: AirSummary }) {
  const { t } = useApp();
  const w = summary.windows[0];
  const text = !w
    ? t("today.flat")
    : t(dayOf(w.start) === dayOf(summary.now) ? "today.clean" : "today.cleanTomorrow", {
        start: clockOf(w.start),
        end: clockOf(w.end),
        pm: Math.round(w.meanPm25),
      });
  return <p className="mt-4 max-w-prose">{text}</p>;
}
