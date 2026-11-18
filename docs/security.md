# Security

Breathprint has nothing worth stealing by design: no accounts, no database, no cookies, and no stored photos. What it does have is a free model quota anyone could burn, an API that takes text and photos from strangers, and a model whose output reaches a page. This document says what could go wrong and where the code stops it.

## What's being protected

| Asset                 | Where it lives                                            | Why it matters                                                                            |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Gemini API key        | Vercel environment variable, read once by `server/env.ts` | Spending it costs quota; leaking it costs the account                                     |
| Model quota           | A few hundred free requests a day                         | Once it's gone, every visitor gets the rule-based plan                                    |
| A household's profile | `localStorage` in the visitor's browser                   | Ages, health conditions and commute are personal                                          |
| Precise location      | The browser only                                          | Rounded to 0.1 degree (about 11 km) before any request                                    |
| Room photos           | Request memory only                                       | Downscaled and re-encoded in the browser, which strips EXIF; never written down or logged |

## Threats and what stops them

| Threat                                 | Control                                                                                                                                                                                       | Code                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Quota burned by a script               | Vercel firewall: 120 requests a minute per IP on `/api/*`, answered with 429 at the edge. Behind it, the app's own limiter: 60 a minute per visitor on the API and 8 on the four model routes | Firewall rule `api rate limit`; `server/middleware/rateLimit.ts` |
| Oversized or malformed requests        | 16 KB body limit (1.4 MB for a photo), zod schema on every route, JPEG magic bytes checked before a photo reaches the model                                                                   | `server/app.ts`, `server/routes/*`, `server/routes/scan.ts`      |
| Cross-site requests                    | Writes must come from this site's own origin with a JSON or form content type; there are no cookies to ride on                                                                                | `server/middleware/guards.ts`                                    |
| Script injection into the page         | CSP of `default-src 'self'` with no inline script or style, and model text rendered as React text, never as HTML                                                                              | `server/headers.ts`                                              |
| Clickjacking, sniffing, referrer leaks | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `strict-origin-when-cross-origin`, HSTS with preload, COOP and CORP                                                                   | `server/headers.ts`                                              |
| Server-side request forgery            | Upstream hosts are fixed in code and the server builds every URL itself: a rounded grid cell for the forecast, a URL-encoded place name for search                                            | `server/air/`, `server/geocode.ts`                               |
| Personal data in logs                  | One line per request: id, method, path, status and time. No query, body or address. IPs are hashed with a salt that changes daily before the limiter counts them                              | `server/middleware/log.ts`, `server/middleware/rateLimit.ts`     |
| A leaked key in git                    | gitleaks on every push in CI and before every local push; `.env` is git-ignored                                                                                                               | `.github/workflows/security.yml`                                 |
| A vulnerable or hijacked dependency    | `bun audit` in CI, CodeQL weekly and on every push, Dependabot with a seven-day cooldown, every GitHub Action pinned to a commit SHA, a lockfile installed with `--frozen-lockfile`           | `.github/`                                                       |

## The model: OWASP Top 10 for LLM applications (2025)

| Risk                                   | How Breathprint handles it                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM01 Prompt injection                 | User text and retrieved notes go into tagged blocks the prompt calls data. The model has no tools, so an injected instruction can change words but take no action. The eval set includes an injection case that must not reveal the system prompt.                                                                                                                              |
| LLM02 Sensitive information disclosure | The model sees a coarse location and the household's age groups and conditions, nothing that names a person. There is nothing else in its context to disclose.                                                                                                                                                                                                                  |
| LLM03 Supply chain                     | One SDK, `@google/genai`, pinned in the lockfile and covered by the dependency controls above. Model ids live in config, so a model can be swapped without code changes.                                                                                                                                                                                                        |
| LLM04 Data and model poisoning         | No fine-tuning and no user content kept between requests. The knowledge cards the model cites are files in this repository, reviewed like code.                                                                                                                                                                                                                                 |
| LLM05 Improper output handling         | Every structured reply is parsed against a zod schema. Action and card ids the model cites are checked against the list it was given; unknown ids are dropped. Output is never rendered as HTML.                                                                                                                                                                                |
| LLM06 Excessive agency                 | The model chooses and explains; it can't call anything. Every number comes from the tested engine in `shared/`, attached by action id after validation.                                                                                                                                                                                                                         |
| LLM07 System prompt leakage            | The prompts are in this public repository on purpose. They hold no secrets, so leaking one costs nothing.                                                                                                                                                                                                                                                                       |
| LLM08 Vector and embedding weaknesses  | No embeddings. Retrieval is BM25 over a fixed, cited card set.                                                                                                                                                                                                                                                                                                                  |
| LLM09 Misinformation                   | A figure guard checks every number with a unit in a model answer against the grounding packet and flags any that isn't there. The planner's checker rejects unsafe plans (ventilating outside a clean window, sealing a room with a fuel heater) and falls back to the engine's plan. The model is told it isn't a doctor and to send anyone with danger signs to medical help. |
| LLM10 Unbounded consumption            | Token caps on every job, a 12 s timeout per call inside a 25 s budget, at most 12 chat messages of 600 characters each, answers cached by prompt version, and the two rate limits above. When the quota runs out, the app degrades to the engine's plan instead of failing.                                                                                                     |

## The firewall rule

Vercel's Hobby plan includes one rate-limit rule. Breathprint's:

- **Matches:** any request whose path starts with `/api/`.
- **Limit:** 120 requests in a fixed 60-second window, keyed by client IP.
- **Over the limit:** 429 at the edge, so the function never starts.

It sits well above anything a person does in the app, so it only meets scripts. Checked on 18 November 2026: 130 back-to-back requests to `/api/health` returned 118 OK and 12 rate-limited, and the pages and API answered normally once the window passed. The app's own per-IP limits stay in place behind it, so a shared IP that trips the edge rule and a single visitor hammering the model routes are both covered.

## What isn't covered

- The app's limiter keeps its counters in each function instance's memory, so a burst spread across many instances can exceed it. The edge rule bounds that.
- No CAPTCHA or bot challenge. For a free tool with no accounts, the rate limits and the fallback plan are the right trade.
- A determined user can still make the model say something unhelpful inside the app's own topic. The schema, the checker and the figure guard limit how much that matters, not whether it happens.
