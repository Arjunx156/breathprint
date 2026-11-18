import { readFile, writeFile } from "node:fs/promises";
import { type Browser, chromium } from "playwright-core";
import { summarize } from "../shared/air";
import { aqi } from "../shared/aqi";
import { DEMO_DAY, delhiMorning, delhiSevereSnapshot } from "../shared/fixtures";

/**
 * Renders the favicon PNGs and the 1200×630 social card from HTML, so they
 * share the app's type and colours. Run with `bun run scripts/assets.ts`
 * after changing the mark or the card; the outputs are committed.
 */
const PUBLIC = "web/public";
const INK = "#16171a";
const BG = "#f4f3f0";
const MUTED = "#5e6066";
const ACCENT_ON_INK = "#8db8f2";
const LEVELS = ["#3c8d5a", "#98b23d", "#d8b23a", "#e07b2e", "#c9372c", "#7a2335"];

/** The mark: a fingerprint's core drawn as breath rising, on an ink tile. */
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Breathprint</title>
  <rect width="64" height="64" rx="14" fill="${INK}"/>
  <g fill="none" stroke-linecap="round" stroke-width="4.5">
    <path d="M13 51V34a19 19 0 0 1 38 0v7" stroke="${BG}"/>
    <path d="M22.5 53V34a9.5 9.5 0 0 1 19 0v13" stroke="${BG}"/>
    <path d="M32 34v21" stroke="${ACCENT_ON_INK}"/>
  </g>
</svg>
`;

async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    // No Playwright Chromium downloaded: Windows always has Edge.
    return chromium.launch({ channel: "msedge" });
  }
}

async function png(browser: Browser, html: string, width: number, height: number, path: string) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(path, await page.screenshot({ type: "png", omitBackground: true }));
  await page.close();
  console.info(`wrote ${path}`);
}

/** iOS rounds touch icons itself and fills transparency with black, so those go full-bleed. */
function icon(size: number, fullBleed = false): string {
  const svg = MARK.replace("<svg ", `<svg width="${size}" height="${size}" `);
  return `<body style="margin:0">${fullBleed ? svg.replace('rx="14"', 'rx="0"') : svg}</body>`;
}

async function card(): Promise<string> {
  const font = await readFile(
    "node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
  );
  const summary = summarize(delhiSevereSnapshot(DEMO_DAY), delhiMorning(DEMO_DAY));
  const top = Math.max(...summary.series.map((h) => h.pm25 ?? 0));
  const bars = summary.series
    .map((h) => {
      const pm = h.pm25 ?? 0;
      const colour = LEVELS[aqi("IN", pm, null).level];
      return `<i style="height:${Math.max(4, (pm / top) * 100)}%;background:${colour}"></i>`;
    })
    .join("");
  const mark = MARK.replace("<svg ", '<svg width="52" height="52" ');
  return `<!doctype html><html><head><style>
    @font-face { font-family: "Instrument Serif"; src: url(data:font/woff2;base64,${font.toString("base64")}) format("woff2"); }
    body { margin: 0; width: 1200px; height: 630px; background: ${BG}; color: ${INK}; font-family: "Segoe UI", system-ui, sans-serif; position: relative; overflow: hidden; }
    .serif { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; }
    .brand { position: absolute; left: 80px; top: 64px; display: flex; align-items: center; gap: 18px; font-size: 44px; }
    h1 { position: absolute; left: 80px; top: 158px; margin: 0; font-size: 92px; line-height: 1; letter-spacing: -0.01em; }
    p { position: absolute; left: 80px; top: 372px; margin: 0; width: 760px; font-size: 27px; line-height: 1.4; color: ${MUTED}; }
    .ribbon { position: absolute; left: 80px; right: 80px; bottom: 56px; height: 96px; display: flex; align-items: flex-end; gap: 5px; }
    .ribbon i { flex: 1; display: block; border-radius: 2px 2px 0 0; }
  </style></head><body>
    <div class="brand serif">${mark}<span>Breathprint</span></div>
    <h1 class="serif">Every choice leaves<br>a breathprint.</h1>
    <p>A smog-season plan for your family and your street, with the numbers behind every step.</p>
    <div class="ribbon">${bars}</div>
  </body></html>`;
}

const renderer = await launch();
await writeFile(`${PUBLIC}/favicon.svg`, MARK);
console.info(`wrote ${PUBLIC}/favicon.svg`);
await png(renderer, icon(32), 32, 32, `${PUBLIC}/favicon-32.png`);
await png(renderer, icon(180, true), 180, 180, `${PUBLIC}/apple-touch-icon.png`);
await png(renderer, icon(192, true), 192, 192, `${PUBLIC}/icon-192.png`);
await png(renderer, icon(512, true), 512, 512, `${PUBLIC}/icon-512.png`);
await png(renderer, await card(), 1200, 630, `${PUBLIC}/og.png`);
await renderer.close();
