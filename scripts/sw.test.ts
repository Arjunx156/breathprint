import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { precacheList, stampWorker } from "./sw";

describe("precacheList", () => {
  test("keeps code, styles and woff2 fonts, sorted, after both pages", () => {
    const list = precacheList(["b.js", "a.css", "font.woff", "font.woff2", "og.png", "a.js"]);
    expect(list).toEqual([
      "/",
      "/blog/",
      "/assets/a.css",
      "/assets/a.js",
      "/assets/b.js",
      "/assets/font.woff2",
    ]);
  });
});

describe("stampWorker", () => {
  test("fills the real worker's build id and file list", async () => {
    const source = await readFile("web/public/sw.js", "utf8");
    const files = precacheList(["app-1.js"]);
    const stamped = stampWorker(source, files);
    expect(stamped).toMatch(/const BUILD = "[0-9a-f]{12}";/);
    expect(stamped).toContain(`const PRECACHE = ${JSON.stringify(files)};`);
  });

  test("a different build gets a different cache", async () => {
    const source = await readFile("web/public/sw.js", "utf8");
    const one = stampWorker(source, precacheList(["app-1.js"]));
    const two = stampWorker(source, precacheList(["app-2.js"]));
    expect(one.match(/BUILD = "(\w+)"/)?.[1]).not.toBe(two.match(/BUILD = "(\w+)"/)?.[1]);
  });

  test("refuses a worker that lost its slots", () => {
    expect(() => stampWorker("self.addEventListener('fetch', () => {});", [])).toThrow();
  });
});
