import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { siteUrl } from "./scripts/site";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Writes the public origin into index.html, where links and social cards need it absolute. */
function site(): Plugin {
  const url = siteUrl();
  return {
    name: "breathprint-site-url",
    transformIndexHtml: (html) => html.replaceAll("__SITE__", url),
  };
}

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss(), site()],
  resolve: {
    alias: { "@shared": at("./shared"), "@web": at("./web/src") },
  },
  build: {
    outDir: at("./dist/public"),
    emptyOutDir: true,
    target: "es2022",
    // The CSP allows fonts and scripts from this origin only, never data: URLs.
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
