import type { AirSummary } from "@shared/air";
import { aqi, type Scale } from "@shared/aqi";
import { clock, dayOf } from "@shared/format";
import { useId, useState } from "react";
import { useApp } from "../../app/state";
import { weekdayShort } from "../../lib/format";
import { RibbonChart } from "./RibbonChart";

type Hour = AirSummary["series"][number];

type Props = { summary: AirSummary; scale: Scale };

/**
 * The signature view: the next 48 hours as bars coloured by AQI level, with
 * the cleaner windows bracketed and the WHO guideline drawn across. A table
 * carries the same numbers for anyone who can't use the chart.
 */
export function Ribbon({ summary, scale }: Props) {
  const { t, lang } = useApp();
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const first = summary.series[0];
  const last = summary.series.at(-1);
  if (!first || !last) return null;

  const desc = t("today.ribbonDesc", {
    start: `${weekdayShort(first.time, lang)} ${clock(first.time)}`,
    end: `${weekdayShort(last.time, lang)} ${clock(last.time)}`,
  });

  return (
    <figure aria-labelledby={titleId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <figcaption id={titleId} className="text-lg font-semibold">
          {t("today.ribbonTitle")}
        </figcaption>
        {/* The label names what a press does, so it carries no pressed state of its own. */}
        <button
          type="button"
          className="link min-h-11 text-sm"
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? t("today.asChart") : t("today.asTable")}
        </button>
      </div>
      {asTable ? (
        <HourTable series={summary.series} scale={scale} caption={desc} />
      ) : (
        <RibbonChart summary={summary} scale={scale} label={desc} />
      )}
      <CleanWindow summary={summary} />
    </figure>
  );
}

/** The same 48 hours as rows, for screen readers and anyone who would rather read than look. */
function HourTable({
  series,
  scale,
  caption,
}: {
  series: readonly Hour[];
  scale: Scale;
  caption: string;
}) {
  const { t, tx, lang } = useApp();
  return (
    <div className="mt-3 rounded-lg border border-line">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
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
                {weekdayShort(h.time, lang)} {clock(h.time)}
              </th>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {h.pm25 === null ? "–" : Math.round(h.pm25)}
              </td>
              <td className="px-3 py-1.5">
                {h.pm25 === null ? "–" : tx(`aqi.${scale}.${aqi(scale, h.pm25, null).category}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CleanWindow({ summary }: { summary: AirSummary }) {
  const { t } = useApp();
  const w = summary.windows[0];
  const text = w
    ? t(dayOf(w.start) === dayOf(summary.now) ? "today.clean" : "today.cleanTomorrow", {
        start: clock(w.start),
        end: clock(w.end),
        pm: Math.round(w.meanPm25),
      })
    : t("today.flat");
  return <p className="mt-4 max-w-prose">{text}</p>;
}
