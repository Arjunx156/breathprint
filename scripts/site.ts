/**
 * The public origin the build writes into canonical links, the sitemap and
 * social cards. Vercel sets VERCEL_PROJECT_PRODUCTION_URL during its builds;
 * SITE_URL overrides it for any other host; local builds point at localhost.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${env.PORT ?? 8787}`;
}

/** Where the live site is, for content written to be read off this site too. */
export const PRODUCTION_URL = "https://breathprint-zeta.vercel.app";

/** Every page worth indexing: the app's front page and the blog; the rest is per household. */
const PAGES = ["/", "/blog/"];

export function robotsTxt(site: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`;
}

export function sitemapXml(site: string): string {
  const urls = PAGES.map((p) => `  <url><loc>${site}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
