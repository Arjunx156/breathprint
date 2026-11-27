import { describe, expect, test } from "bun:test";
import {
  notFoundShell,
  PRODUCTION_URL,
  pageShell,
  preloadHeadingFont,
  robotsTxt,
  sitemapXml,
  siteUrl,
} from "./site";

const SHELL = `<head><title>Breathprint</title>
<link rel="canonical" href="https://air.example/" />
<meta property="og:url" content="https://air.example/" /></head>`;

describe("site", () => {
  test("SITE_URL wins over Vercel's domain and loses its trailing slash", () => {
    expect(
      siteUrl({ SITE_URL: "https://air.example/", VERCEL_PROJECT_PRODUCTION_URL: "bp.vercel.app" }),
    ).toBe("https://air.example");
  });

  test("a Vercel build uses the production domain over https", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "bp.vercel.app" })).toBe(
      "https://bp.vercel.app",
    );
  });

  test("a local build points at the dev server", () => {
    expect(siteUrl({ PORT: "3000" })).toBe("http://localhost:3000");
    expect(siteUrl({})).toBe("http://localhost:8787");
  });

  test("robots keep crawlers off the API and point at the sitemap", () => {
    const robots = robotsTxt("https://air.example");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Sitemap: https://air.example/sitemap.xml");
  });

  test("the sitemap lists the front page and the blog, and nothing per household", () => {
    const xml = sitemapXml("https://air.example");
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(["https://air.example/", "https://air.example/blog/"]);
  });

  test("each page's HTML carries its own title and canonical address", () => {
    const html = pageShell(SHELL, "/ask", "Ask · Breathprint", "https://air.example");
    expect(html).toContain("<title>Ask · Breathprint</title>");
    expect(html).toContain('<link rel="canonical" href="https://air.example/ask" />');
    expect(html).toContain('<meta property="og:url" content="https://air.example/ask" />');
    expect(pageShell(SHELL, "/", 'A <b> & "c"', "https://air.example")).toContain(
      "<title>A &lt;b&gt; &amp; &quot;c&quot;</title>",
    );
  });

  test("the lost page is titled as lost and asks not to be indexed", () => {
    const html = notFoundShell(SHELL, "Lost · Breathprint");
    expect(html).toContain("<title>Lost · Breathprint</title>");
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toContain("canonical");
    expect(html).not.toContain("og:url");
  });

  test("a shell that lost a tag fails the build instead of shipping the wrong address", () => {
    expect(() => pageShell("<title>x</title>", "/ask", "Ask", "https://air.example")).toThrow(
      /canonical/,
    );
  });

  test("security.txt names a contact, points at itself and has not expired", async () => {
    const fields = new Map(
      (await Bun.file("web/public/.well-known/security.txt").text())
        .split(/\r?\n/)
        .filter((line) => line.includes(": "))
        .map((line) => [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2)]),
    );
    expect(fields.get("Contact")).toStartWith("https://github.com/Arjunx156/breathprint/security");
    expect(fields.get("Canonical")).toBe(`${PRODUCTION_URL}/.well-known/security.txt`);
    expect(Date.parse(fields.get("Expires") ?? "")).toBeGreaterThan(Date.now());
  });

  test("the heading face is asked for with the page, not after its stylesheet", () => {
    const assets = [
      "app-x1.js",
      "instrument-serif-latin-400-italic-Ab1.woff2",
      "instrument-serif-latin-400-normal-Cd2_e.woff2",
    ];
    const html = preloadHeadingFont(SHELL, assets);
    expect(html).toContain(
      '<link rel="preload" href="/assets/instrument-serif-latin-400-normal-Cd2_e.woff2" as="font" type="font/woff2" crossorigin />',
    );
    expect(html.indexOf("preload")).toBeLessThan(html.indexOf("</head>"));
    expect(() => preloadHeadingFont(SHELL, ["app-x1.js"])).toThrow(/heading font/);
  });
});
