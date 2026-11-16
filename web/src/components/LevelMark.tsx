const BARS = [0, 1, 2, 3, 4, 5] as const;

/**
 * Six rising bars, filled up to the level: the AQI band reads by shape and
 * count as well as colour, so it survives colour blindness and greyscale.
 */
export function LevelMark({ level, label }: { level: number; label: string }) {
  return (
    <svg
      viewBox="0 0 34 18"
      width="34"
      height="18"
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      {BARS.map((i) => {
        const height = 5 + i * 2.6;
        return (
          <rect
            key={i}
            x={i * 5.8}
            y={18 - height}
            width="4"
            height={height}
            rx="1"
            fill={i <= level ? `var(--lvl-${level})` : "var(--line)"}
          />
        );
      })}
    </svg>
  );
}
