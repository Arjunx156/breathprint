import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath, type Plugin } from "vite";
import { siteUrl } from "./scripts/site.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Writes the public origin into index.html, where links and social cards need it absolute. */
function site(): Plugin {
  const url = siteUrl();
  return {
    name: "breathprint-site-url",
    transformIndexHtml: (html) => html.replaceAll("__SITE__", url),
  };
}

/**
 * Points shared/i18n's Hindi import at web/src/lib/hindi.ts, which loads the
 * strings when someone picks Hindi. English readers save about 10 KB.
 */
function lazyHindi(): Plugin {
  // Vite's own id for this file uses forward slashes; a Windows path here makes a second, empty copy.
  const stub = normalizePath(at("./web/src/lib/hindi.ts"));
  return {
    name: "breathprint-lazy-hindi",
    enforce: "pre",
    resolveId(source, importer) {
      const fromIndex = importer?.replaceAll("\\", "/").endsWith("/shared/i18n/index.ts");
      return source === "./hi" && fromIndex ? stub : null;
    },
  };
}

export default defineConfig({
  root: "web",
  plugins: [lazyHindi(), react(), tailwindcss(), site()],
  resolve: {
    alias: { "@shared": at("./shared") },
  },
  build: {
    outDir: at("./dist/public"),
    emptyOutDir: true,
    target: "es2022",
    // The CSP allows fonts and scripts from this origin only, never data: URLs.
    assetsInlineLimit: 0,
    // The blog is a plain page with no script; the build fills in the post.
    rollupOptions: { input: { app: at("./web/index.html"), blog: at("./web/blog/index.html") } },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
