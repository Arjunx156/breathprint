/**
 * The public origin the build writes into canonical links, the sitemap and
 * social cards. Vercel sets VERCEL_PROJECT_PRODUCTION_URL during its builds;
 * SITE_URL overrides it for any other host; local builds point at localhost.
 */
const TRAILING_SLASHES = /\/+$/;

/** The site's own origin: set, Vercel's production URL, or local. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.SITE_URL) return env.SITE_URL.replace(TRAILING_SLASHES, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${env.PORT ?? 8787}`;
}

/** Where the live site is, for content written to be read off this site too. */
export const PRODUCTION_URL = "https://breathprint-zeta.vercel.app";

/** Every page worth indexing: the app's front page and the blog; the rest is per household. */
const INDEXED = ["/", "/blog/"];

/** Lets crawlers in everywhere but the API. */
export function robotsTxt(site: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`;
}

/** Every page a visitor can land on. */
export function sitemapXml(site: string): string {
  const urls = INDEXED.map((p) => `  <url><loc>${site}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const TITLE = /<title>[^<]*<\/title>/;
const CANONICAL = /<link rel="canonical" href="[^"]*" \/>/;
const OG_URL = /<meta property="og:url" content="[^"]*" \/>/;

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);

/** Replaces the one tag `pattern` finds, and fails the build if the shell lost it. */
function swap(html: string, pattern: RegExp, tag: string): string {
  if (!pattern.test(html)) throw new Error(`index.html lost its ${pattern.source}`);
  return html.replace(pattern, tag);
}

/**
 * The app's HTML under one page's title and address, so a crawler that runs
 * no script still finds each page under its own name and canonical link.
 */
export function pageShell(html: string, path: string, title: string, site: string): string {
  const url = `${site}${path}`;
  const named = swap(html, TITLE, `<title>${escapeHtml(title)}</title>`);
  const linked = swap(named, CANONICAL, `<link rel="canonical" href="${url}" />`);
  return swap(linked, OG_URL, `<meta property="og:url" content="${url}" />`);
}

/** The app's HTML for an address that isn't there: titled as lost, with nothing to index. */
export function notFoundShell(html: string, title: string): string {
  const named = swap(html, TITLE, `<title>${escapeHtml(title)}</title>`);
  const unlinked = swap(named, CANONICAL, '<meta name="robots" content="noindex" />');
  return swap(unlinked, OG_URL, "");
}
