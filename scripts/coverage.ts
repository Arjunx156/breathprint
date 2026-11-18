import { readFile } from "node:fs/promises";

/** Bars from the plan: the engine every figure comes from is held higher. */
export const GATES = [
  { name: "all code", prefix: "", lines: 90, functions: 90 },
  { name: "shared engine", prefix: "shared/", lines: 95, functions: 95 },
] as const;

export type Totals = { lines: [hit: number, found: number]; functions: [number, number] };

/** Sums an lcov report's line and function counts for files under `prefix`. */
export function totals(lcov: string, prefix: string): Totals {
  const sum: Totals = { lines: [0, 0], functions: [0, 0] };
  let inside = false;
  for (const raw of lcov.split("\n")) {
    const [tag, value = ""] = raw.trim().split(":", 2) as [string, string?];
    if (tag === "SF") inside = value.replaceAll("\\", "/").startsWith(prefix);
    if (!inside) continue;
    const n = Number(value);
    if (tag === "LH") sum.lines[0] += n;
    if (tag === "LF") sum.lines[1] += n;
    if (tag === "FNH") sum.functions[0] += n;
    if (tag === "FNF") sum.functions[1] += n;
  }
  return sum;
}

export const percent = ([hit, found]: [number, number]) => (found ? (hit / found) * 100 : 100);

if (import.meta.main) {
  const lcov = await readFile("coverage/lcov.info", "utf8");
  let failed = false;
  for (const gate of GATES) {
    const t = totals(lcov, gate.prefix);
    const lines = percent(t.lines);
    const functions = percent(t.functions);
    const ok = lines >= gate.lines && functions >= gate.functions;
    failed ||= !ok;
    console.info(
      `${ok ? "ok  " : "FAIL"} ${gate.name}: lines ${lines.toFixed(1)}% (bar ${gate.lines}), functions ${functions.toFixed(1)}% (bar ${gate.functions})`,
    );
  }
  if (failed) process.exit(1);
}
