import { describe, expect, test } from "bun:test";
import { robotsTxt, sitemapXml, siteUrl } from "./site";

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
});
