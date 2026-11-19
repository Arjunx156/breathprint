import { createHash } from "node:crypto";

const OFFLINE_ASSET = /\.(js|css|woff2)$/;

/** What a visitor needs offline: both pages, and the app's code, styles and fonts. */
export function precacheList(assets: readonly string[]): string[] {
  const files = assets
    .filter((name) => OFFLINE_ASSET.test(name))
    .sort()
    .map((name) => `/assets/${name}`);
  return ["/", "/blog/", ...files];
}

/**
 * Writes the build's file list into the service worker. Asset names carry
 * content hashes, so a new build gets a new cache and the old one is dropped.
 */
export function stampWorker(source: string, files: readonly string[]): string {
  const build = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
  const BUILD = 'const BUILD = "dev";';
  const PRECACHE = "const PRECACHE = [];";
  if (!source.includes(BUILD) || !source.includes(PRECACHE)) {
    throw new Error("sw.js lost its BUILD or PRECACHE line");
  }
  return source
    .replace(BUILD, `const BUILD = "${build}";`)
    .replace(PRECACHE, `const PRECACHE = ${JSON.stringify(files)};`);
}
