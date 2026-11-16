/**
 * Local development: the API on :8787, restarting on change, and Vite on
 * :5173 proxying /api to it. Ctrl+C stops both.
 */
const procs = [
  Bun.spawn(["bun", "--watch", "server/serve.ts"], { stdout: "inherit", stderr: "inherit" }),
  Bun.spawn(["bun", "x", "vite"], { stdout: "inherit", stderr: "inherit", stdin: "inherit" }),
];

const stopAll = () => {
  for (const p of procs) p.kill();
  process.exit(0);
};
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

await Promise.race(procs.map((p) => p.exited));
stopAll();

export {};
