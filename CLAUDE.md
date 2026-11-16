# Breathprint

A smog-season assistant for families and communities, built for PromptWars 6 (see `HACKATHON.md`). It plans a day that cuts what a family breathes (Protect) and what it adds to the street's air (Prevent), and shows the numbers behind every step. Good means: every figure comes from the tested engine, Gemini only chooses and explains, and the app never goes blank when the model or the network does.

## Commands

- `just dev`: API on :8787, app on :5173
- `just check`: biome, tsc, unit tests, build and JS budget (must pass before any commit)
- `just fmt`: fix formatting and autofixable lint
- `just e2e`: Playwright with axe; `just eval`: model evals (needs `GEMINI_API_KEY`)

## Layout

- `shared/`: pure TypeScript engine, imported by both sides. AQI, air summary, exposure, factors with sources, action catalogue, planner and checker, knowledge cards, i18n. No I/O.
- `server/`: Hono API. `app.ts` composes middleware and routes; `main.ts` wires real upstreams; `serve.ts` (Bun) and `vercel.ts` (Vercel) are entries.
- `web/`: React app built by Vite into `dist/public`.
- `scripts/build.ts`: writes `.vercel/output` (static, one function, routes and headers), plus robots and sitemap from `scripts/site.ts`.
- `scripts/assets.ts`: renders the favicons and `og.png` into `web/public`; rerun after changing the mark.

## Conventions

- A number shown to a user comes from `shared/`, with a factor in `factors.ts` and a source in `sources.ts`. Copy uses `{placeholders}`, never literal figures.
- New strings go in `shared/i18n/en.ts` and `hi.ts`; the type system rejects a missing Hindi key.
- Security headers live only in `server/headers.ts`.
- Precise location never leaves the browser; the server rounds to 0.1 degree and redirects anything finer.
- Schemas in `shared/` use `zod/mini` so the browser bundle stays under the 120 KB budget; server-only schemas may use classic `zod`.
- `sd -F` silently does nothing on multi-line patterns here; use an editor for those.
