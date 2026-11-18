/**
 * Turns docs/blog.md into the body of /blog/. The Markdown stays the one
 * source, ready to paste anywhere; the site only adapts it to its own CSP.
 */

const WORDS_PER_MINUTE = 220;

export type BlogPage = { body: string; minutes: number };

/** Reading time for the prose, leaving code blocks out of the count. */
export function readingMinutes(markdown: string): number {
  const prose = markdown.replace(/```[\s\S]*?```/g, "");
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * The post as HTML for this site: images from our own origin are served
 * relative (the CSP allows only 'self'), the cover gets its size so nothing
 * jumps, a byline goes under the title, and code blocks that scroll sideways
 * take keyboard focus so they can be scrolled without a mouse.
 */
export function renderBlog(
  markdown: string,
  origin: string,
  byline: (minutes: number) => string,
): BlogPage {
  const minutes = readingMinutes(markdown);
  const html = Bun.markdown
    .html(markdown)
    .replaceAll(`src="${origin}/`, 'src="/')
    .replace(/<img ([^>]*?)\s*\/>/, '<img $1 width="1200" height="630" />')
    .replace("</h1>", `</h1>\n<p class="byline">${byline(minutes)}</p>`)
    .replaceAll("<pre>", '<pre tabindex="0">');
  return { body: html, minutes };
}
