import { describe, expect, test } from "bun:test";
import { readingMinutes, renderBlog } from "./blog";

const ORIGIN = "https://breathprint-zeta.vercel.app";

describe("blog page", () => {
  test("serves our own images relative, sized, with the byline under the title", () => {
    const md = `# Title\n\n![Cover](${ORIGIN}/og.png)\n\nText with [a link](${ORIGIN}/?demo=meera).`;
    const { body } = renderBlog(md, ORIGIN, (m) => `Arjun Krishnan · ${m} min read`);
    expect(body).toContain('<h1>Title</h1>\n<p class="byline">Arjun Krishnan · 1 min read</p>');
    expect(body).toContain('src="/og.png"');
    expect(body).toContain('width="1200" height="630"');
    // Links keep their full address; only images must come from 'self'.
    expect(body).toContain(`href="${ORIGIN}/?demo=meera"`);
  });

  test("code blocks take keyboard focus, so a wide one can be scrolled without a mouse", () => {
    const { body } = renderBlog("```ts\nconst a = 1;\n```\n", ORIGIN, () => "");
    expect(body).toContain('<pre tabindex="0"><code class="language-ts">');
  });

  test("counts reading time on the prose, not the code", () => {
    const prose = Array.from({ length: 440 }, () => "word").join(" ");
    const code = `\n\n\`\`\`ts\n${Array.from({ length: 2000 }, () => "x").join(" ")}\n\`\`\`\n`;
    expect(readingMinutes(prose)).toBe(2);
    expect(readingMinutes(prose + code)).toBe(2);
    expect(readingMinutes("")).toBe(1);
  });
});
