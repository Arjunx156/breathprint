/**
 * Every server log line goes through here: one JSON object per line, which
 * Vercel and any container host collect from stdout and stderr. Lines carry
 * ids, outcomes and timings; never a body, a query or an address.
 */
export type Level = "info" | "warn" | "error";
/** The values on one log line. */
export type Fields = Readonly<Record<string, unknown>>;
/** Where log lines go. */
export type Sink = (level: Level, fields: Fields) => void;

/** One JSON line per event, errors to stderr. */
export const toConsole: Sink = (level, fields) => {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
};

let sink: Sink = toConsole;

/** The server's only logger. */
export const logger = {
  info: (fields: Fields) => sink("info", fields),
  warn: (fields: Fields) => sink("warn", fields),
  error: (fields: Fields) => sink("error", fields),
};

/** Sends every line somewhere else until the returned function puts it back. */
export function redirectLogs(next: Sink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}
