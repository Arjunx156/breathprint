import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { IMMUTABLE, SECURITY_HEADERS } from "@server/headers";
import { type MessageKey, t } from "@shared/i18n";
import { itemAt } from "@shared/list";
import { lostTitle, NOT_FOUND_FILE, PAGES, pageFile, pageTitle } from "@shared/pages";
import { renderBlog } from "./blog";
import { notFoundShell, PRODUCTION_URL, pageShell, robotsTxt, sitemapXml, siteUrl } from "./site";
import { precacheList, stampWorker } from "./sw";

/**
 * Builds the app and the API into Vercel's Build Output format:
 *   .vercel/output/static            the Vite build
 *   .vercel/output/functions/api.func one bundled Node function for /api/*
 *   .vercel/output/config.json        routes and headers
 * then checks the JavaScript budget.
 */
const OUT = ".vercel/output";
const STATIC = "dist/public";
const FUNC = join(OUT, "functions/api.func");
/** Initial JavaScript a phone on 3G downloads before the plan appears. */
const JS_BUDGET_GZIP = 120 * 1024;

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(" ")} failed`);
}

async function buildFunction() {
  const result = await Bun.build({
    entrypoints: ["server/vercel.ts"],
    target: "node",
    format: "esm",
    minify: true,
    outdir: FUNC,
    naming: "index.mjs",
  });
  if (!result.success) throw new AggregateError(result.logs, "API bundle failed");
  await writeFile(
    join(FUNC, ".vc-config.json"),
    JSON.stringify({
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 30,
      // Mumbai: closest to the families this is built for.
      regions: ["bom1"],
    }),
  );
}

async function writeConfig() {
  const config = {
    version: 3,
    routes: [
      { src: "/assets/(.*)", headers: { "Cache-Control": IMMUTABLE }, continue: true },
      { src: "/(.*)", headers: SECURITY_HEADERS, continue: true },
      { src: "/sw.js", headers: { "Cache-Control": "no-cache" }, continue: true },
      { src: "/blog", status: 308, headers: { Location: "/blog/" } },
      { src: "/blog/", dest: "/blog/index.html" },
      ...PAGES.map((p) => ({ src: p.path, dest: `/${pageFile(p.path)}` })),
      { handle: "filesystem" },
      { src: "/api/(.*)", dest: "/api" },
      // The app's router would draw the lost page anyway; the status tells crawlers too.
      { src: "/(.*)", status: 404, dest: `/${NOT_FOUND_FILE}` },
    ],
  };
  await writeFile(join(OUT, "config.json"), JSON.stringify(config, null, 2));
}

/** Gzipped size of the scripts index.html loads up front. */
async function initialJs(): Promise<{ file: string; gzip: number }[]> {
  const html = await readFile(join(STATIC, "index.html"), "utf8");
  const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) =>
    itemAt(m, 1),
  );
  return Promise.all(
    files.map(async (file) => ({
      file,
      gzip: gzipSync(await readFile(join(STATIC, file))).length,
    })),
  );
}

/** Pours docs/blog.md into the blog page Vite built around it. */
async function writeBlog() {
  const page = join(STATIC, "blog/index.html");
  const markdown = await readFile("docs/blog.md", "utf8");
  const { body } = renderBlog(
    markdown,
    PRODUCTION_URL,
    (minutes) => `Arjun Krishnan · 18 November 2026 · ${minutes} min read`,
  );
  const shell = await readFile(page, "utf8");
  if (!shell.includes("<!--blog-->")) throw new Error("blog page lost its <!--blog--> slot");
  await writeFile(page, shell.replace("<!--blog-->", body));
}

/**
 * Each page's own copy of the app's HTML, titled and linked in English, and the
 * lost page's. The front page's copy is index.html itself, rewritten as it was.
 */
async function writePages(origin: string) {
  const html = await readFile(join(STATIC, "index.html"), "utf8");
  const en = (key: MessageKey) => t("en", key);
  const page = ({ path }: (typeof PAGES)[number]) =>
    writeFile(join(STATIC, pageFile(path)), pageShell(html, path, pageTitle(path, en), origin));
  const lost = writeFile(join(STATIC, NOT_FOUND_FILE), notFoundShell(html, lostTitle(en)));
  await Promise.all([...PAGES.map(page), lost]);
}

async function writeServiceWorker() {
  const worker = join(STATIC, "sw.js");
  const files = precacheList(await readdir(join(STATIC, "assets")));
  await writeFile(worker, stampWorker(await readFile(worker, "utf8"), files));
}

async function totalSize(dir: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) bytes += (await stat(join(entry.parentPath, entry.name))).size;
  }
  return bytes;
}

await rm(OUT, { recursive: true, force: true });
await run(["bun", "x", "vite", "build"]);
await writeBlog();
await writeServiceWorker();
const site = siteUrl();
await writePages(site);
await writeFile(join(STATIC, "robots.txt"), robotsTxt(site));
await writeFile(join(STATIC, "sitemap.xml"), sitemapXml(site));
console.info(`site ${site}`);
await mkdir(FUNC, { recursive: true });
await Promise.all([buildFunction(), cp(STATIC, join(OUT, "static"), { recursive: true })]);
await writeConfig();

const scripts = await initialJs();
const gzip = scripts.reduce((sum, s) => sum + s.gzip, 0);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.info(`initial JS ${kb(gzip)} gzipped (budget ${kb(JS_BUDGET_GZIP)})`);
console.info(
  `static ${kb(await totalSize(join(OUT, "static")))}, function ${kb(await totalSize(FUNC))}`,
);
if (gzip > JS_BUDGET_GZIP) {
  console.error(scripts.map((s) => `${s.file} ${kb(s.gzip)}`).join("\n"));
  process.exit(1);
}
