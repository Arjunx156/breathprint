import type { AirSummary } from "@shared/air";
import { aqi, type Scale } from "@shared/aqi";
import { THRESHOLDS } from "@shared/factors";
import { clock, hourOf } from "@shared/format";
import { useApp } from "../../app/state";
import { weekdayShort } from "../../lib/format";

type Hour = AirSummary["series"][number];
/** A cleaner window and the bar it starts on. */
type Placed = { w: AirSummary["windows"][number]; i: number };

type Props = { summary: AirSummary; scale: Scale; label: string };

/** A round ceiling for the chart, so the WHO line and the bars sit on a sensible scale. */
function ceiling(max: number): number {
  const step = max > 200 ? 100 : 50;
  return Math.max(100, Math.ceil(max / step) * step);
}

const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;

/** The chart as one image for assistive technology, described by `label`. */
export function RibbonChart({ summary, scale, label }: Props) {
  const { t } = useApp();
  const series = summary.series;
  const n = series.length;
  const top = ceiling(Math.max(...series.map((h) => h.pm25 ?? 0)));
  const whoAt = (THRESHOLDS.whoDaily / top) * 100;
  const windows: Placed[] = summary.windows
    .map((w) => ({ w, i: series.findIndex((h) => h.time === w.start) }))
    .filter(({ i }) => i >= 0);

  return (
    <div className={windows.length > 0 ? "mt-12" : "mt-4"}>
      <div className="relative h-36 sm:h-44" role="img" aria-label={label}>
        <Bars series={series} scale={scale} windows={windows} top={top} whoAt={whoAt} />
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
      <HourLabels series={series} />
    </div>
  );
}

/** A faint rule at each midnight after the first, so the two days read apart. */
function Midnights({ series }: { series: readonly Hour[] }) {
  return (
    <>
      {series.map((h, i) =>
        i > 0 && hourOf(h.time) === 0 ? (
          <line
            key={h.time}
            x1={i}
            x2={i}
            y1={0}
            y2={100}
            stroke="var(--line)"
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
    </>
  );
}

/** One bar an hour, as tall as its PM2.5 against the ceiling and coloured by its level. */
function HourBars({ series, scale, top }: { series: readonly Hour[]; scale: Scale; top: number }) {
  return (
    <>
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
    </>
  );
}

/** One unit per hour across, 0 to 100 up; the bars stretch to whatever width the page gives. */
function Bars({
  series,
  scale,
  windows,
  top,
  whoAt,
}: {
  series: readonly Hour[];
  scale: Scale;
  windows: readonly Placed[];
  top: number;
  whoAt: number;
}) {
  const n = series.length;
  return (
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
      <Midnights series={series} />
      <HourBars series={series} scale={scale} top={top} />
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
  );
}

/** "Now", then every sixth hour, with the day's name at midnight. */
function HourLabels({ series }: { series: readonly Hour[] }) {
  const { t, lang } = useApp();
  const n = series.length;
  return (
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
          <span key={h.time} className="absolute -translate-x-1/2" style={{ left: pct(i, n) }}>
            {hour === 0 ? weekdayShort(h.time, lang) : clock(h.time)}
          </span>
        );
      })}
    </div>
  );
}
