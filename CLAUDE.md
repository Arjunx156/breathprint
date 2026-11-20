# Breathprint

A smog-season assistant for families and communities, built for PromptWars 6. It plans a day that cuts what a family breathes (Protect) and what it adds to the street's air (Prevent), and shows the numbers behind every step. Good means: every figure comes from the tested engine, Gemini only chooses and explains, and the app never goes blank when the model or the network does.

## Commands

- `just dev`: API on :8787, app on :5173
- `just check`: biome (Markdown too), tsc, knip, tests with the coverage gate (95% of lines overall, 98% of `shared/`, every source file loaded by a test), build, JS budget and eval replay (must pass before any commit). Each step is also a package script: `bun run lint`, `typecheck`, `unused`, `coverage`.
- `just fmt`: fix formatting and autofixable lint
- `just e2e`: Playwright with axe, specs in `tests/e2e/*.e2e.ts` (not `.spec.ts`, which `bun test` would pick up). Don't run it alongside `bun test`; each starves the other into timeouts.
- `just eval`: scores the live model and saves its replies to `evals/recordings`; `just record`: saves demo-day answers to `server/ai/recorded.json`. Both need `GEMINI_API_KEY`; rerun both after changing a prompt and bump `PROMPT_VERSION`.

## Layout

- `shared/`: pure TypeScript engine, imported by both sides. AQI, air summary, exposure, factors with sources, action catalogue, planner and checker, knowledge cards, i18n. No I/O.
- `server/`: Hono API. `app.ts` composes middleware and routes; `main.ts` wires real upstreams; `serve.ts` (Bun) and `vercel.ts` (Vercel) are entries and choose where the client IP comes from. `test/` holds the test harness: the app on fixtures, a fetch stub for the provider adapters, and the preload that quiets the logger.
- `server/ai/`: the four Gemini jobs (plan, chat, advisory, scan), their prompts, grounding packets and the figure guard.
- `web/`: React app built by Vite into `dist/public`; `web/public/sw.js` is the offline worker, stamped with the precache list at build time by `scripts/sw.ts`.
- `web/test/`: the happy-dom page, render helpers and speech fakes for component tests. `bunfig.toml` preloads React DOM with a DOM up, because Bun evaluates CommonJS deps before a test file's own imports, and `server/test/quiet.ts` to silence the logger.
- `docs/`: `architecture.md`, the blog (served at `/blog/`), `security.md` and `accessibility.md`. The Vercel firewall rule they describe lives in the Vercel project, not in this repo.
- `evals/`: cases, pure scorers, the runner and the demo recorder.
- `scripts/build.ts`: writes `.vercel/output` (static, one function, routes and headers), plus robots and sitemap from `scripts/site.ts`.
- `scripts/assets.ts`: renders the favicons and `og.png` into `web/public`; rerun after changing the mark.

## Conventions

- Every side imports the engine as `@shared/…`; relative paths stay inside one side.
- A number shown to a user comes from `shared/`, with a factor in `factors.ts` and a source in `sources.ts`. Copy uses `{placeholders}`, never literal figures.
- New strings go in `shared/i18n/en.ts` and `hi.ts`; the type system rejects a missing Hindi key.
- Security headers live only in `server/headers.ts`. The CSP enforces Trusted Types: a script URL goes through the one policy in `web/src/lib/trusted.ts`, never a plain string.
- Server logs go through `logger` in `server/log.ts`, as JSON with no bodies, queries or addresses; `console` is for scripts only.
- The rate limiter trusts one client address: `x-real-ip` on Vercel, the socket under Bun, or `TRUSTED_IP_HEADER`. Never `X-Forwarded-For`.
- A source file no test loads fails the coverage gate; true entry points are listed in `scripts/coverage.ts`.
- Precise location never leaves the browser; the server rounds to 0.1 degree and redirects anything finer.
- Schemas in `shared/` use `zod/mini` so the browser bundle stays under the 120 KB budget; server-only schemas may use classic `zod`.
- The browser loads Hindi on demand through `web/src/lib/hindi.ts`. The Vite plugin that swaps it in must hand Vite a forward-slash path, or Windows builds ship a second, empty Hindi table.
- Biome caps a function at 50 lines and a cognitive complexity of 10, and keeps `shared/` free of React, Hono, the Gemini SDK, Node built-ins and both sides. Split with a hook, a component or a pure helper; never waive the rule.
- knip runs as `bun x knip@5.88.1`, which carries its own TypeScript 5, because TypeScript 7 has no JS API. Mark an export kept on purpose with `/** @public */`.
- A key built at run time goes through `tx`, which reads an unknown key as itself. Index arrays with `itemAt`, `lastOf` or `isNonEmpty` from `shared/list.ts`, not a cast.
- Pages that need the forecast render inside `AirPage`; a request a newer one replaces starts with `useLatestRequest`; a JSON reply is read with `replyOf`.
- Component tests import `web/test/page` first, then call `withPage()`.
- `sd -F` silently does nothing on multi-line patterns here; use an editor for those.
