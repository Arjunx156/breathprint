import { readFile } from "node:fs/promises";

/** The engine every figure comes from is held higher than the rest. */
export const GATES = [
  { name: "all code", prefix: "", lines: 95, functions: 92 },
  { name: "shared engine", prefix: "shared/", lines: 98, functions: 96 },
] as const;

/** Where the code lives; a file in here that no test loads fails the gate. */
const ROOTS = ["shared", "server", "web/src", "evals", "scripts"] as const;

/**
 * Entry points that only start something real: a server, a build, a live
 * model run. Each is a few lines over parts that are tested on their own.
 */
export const ENTRY_POINTS: ReadonlySet<string> = new Set([
  "evals/record.ts",
  "evals/run.ts",
  "scripts/assets.ts",
  "scripts/build.ts",
  "scripts/dev.ts",
  "server/serve.ts",
  "server/vercel.ts",
  "web/src/main.tsx",
]);

export type Totals = { lines: [hit: number, found: number]; functions: [number, number] };

const slashes = (path: string) => path.replaceAll("\\", "/");

/** Sums an lcov report's line and function counts for files under `prefix`. */
export function totals(lcov: string, prefix: string): Totals {
  const sum: Totals = { lines: [0, 0], functions: [0, 0] };
  let inside = false;
  for (const raw of lcov.split("\n")) {
    const [tag, value = ""] = raw.trim().split(":", 2) as [string, string?];
    if (tag === "SF") inside = slashes(value).startsWith(prefix);
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

const isTest = (path: string) => /\.(test|e2e)\.tsx?$|\.d\.ts$/.test(path);

/**
 * Source files no test loaded. Bun only reports files a test imports, so
 * without this a whole untested page would raise the percentage, not lower it.
 */
export function unloaded(lcov: string, sources: readonly string[]): string[] {
  const loaded = new Set(
    lcov
      .split("\n")
      .filter((line) => line.startsWith("SF:"))
      .map((line) => slashes(line.slice(3).trim())),
  );
  return sources
    .map(slashes)
    .filter((path) => !isTest(path) && !ENTRY_POINTS.has(path) && !loaded.has(path));
}

function sourceFiles(): string[] {
  return ROOTS.flatMap((root) =>
    [...new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: root })].map((p) => `${root}/${slashes(p)}`),
  );
}

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
  const missing = unloaded(lcov, sourceFiles());
  failed ||= missing.length > 0;
  console.info(
    missing.length > 0
      ? `FAIL no test loads: ${missing.join(", ")}`
      : "ok   every source file is loaded by a test",
  );
  if (failed) process.exit(1);
}
