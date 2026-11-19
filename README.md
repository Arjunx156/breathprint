# Breathprint

Every choice leaves a breathprint.

Breathprint turns tomorrow's smog forecast into a plan for your family: when to air the house, which room to filter tonight, which trips to change and who needs a mask. Every step shows what it does for the air your family breathes, the air your street shares and your wallet, with the formula and the source one tap away.

Live at https://breathprint-zeta.vercel.app, or open https://breathprint-zeta.vercel.app/?demo=meera for Meera's family in Delhi on a severe winter morning. Built for PromptWars 6, in English and Hindi. The story of how it was built is at [/blog/](https://breathprint-zeta.vercel.app/blog/).

![Breathprint](web/public/og.png)

## How it meets the brief

| The brief asks for                         | Where it lives                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A GenAI-powered assistant                  | Four Gemini jobs in `server/ai/`: the day's personal plan, Ask by text or voice, a room scan from a photo, and community advisories                                                                     |
| Families and communities                   | A household by age and condition (`shared/profile.ts`); advisories for a housing society, school or workplace, with what many households together keep out of the air (`shared/community.ts`)           |
| Severe winter smog and urban air pollution | CAMS forecasts, India NAQI and US AQI, NowCast, the day's clean window and peak (`shared/aqi.ts`, `shared/air.ts`)                                                                                      |
| Low-emission daily routines                | Commute, school-run and errand swaps, timed against the forecast (`shared/actions/travel.ts`, `shared/plan.ts`)                                                                                         |
| Indoor air quality hacks                   | Airing in the clean window, purifiers and box-fan filters, sealing gaps, cooking and incense, from an indoor mass-balance model; a room scan ranks the fixes for what's in the photo (`shared/scan.ts`) |
| Sustainable alternatives                   | Every step carries a Prevent ledger: PM2.5 and CO2 kept off the street, beside the Protect ledger for the family                                                                                        |
| Tailored to location and lifestyle         | The forecast for your grid cell, your household, travel, home, budget and language                                                                                                                      |
| Clearly explaining the direct impact       | An impact panel per step with a range, the formula and a cited source (`web/src/features/plan/ImpactPanel.tsx`, `shared/sources.ts`)                                                                    |

## How it works

The model may choose and explain, but it never calculates. Every number on screen comes from `shared/`, a tested TypeScript engine that runs in the browser and on the server: AQI on the India and US scales, indoor and travel exposure, emissions, and each action's effect as a range with a cited source in `shared/sources.ts`. Because the engine runs on the device, a checked plan appears instantly. The app installs to a phone's home screen, and after one visit every page opens with no signal at all.

`server/` is a small Hono API that fetches CAMS forecasts and place search from Open-Meteo, caches them, and rounds every location to 0.1 degree. `web/` is the React app. Your household stays in your browser; there are no accounts and no database.

The tooling holds that shape in place. Lint stops `shared/` from importing React, Hono, the Gemini SDK or either side, caps every function at 50 lines and a cognitive complexity of 10, and allows no warnings; knip fails the build on any unused file, export or dependency. [docs/architecture.md](docs/architecture.md) maps the layers, the ports and one plan's trip from the browser to Gemini and back.

## Gemini

Gemini has four jobs, and each one sits behind an answer the engine already gave, so the app never waits on the model or goes blank without it. On Today, once you agree, it writes a plan for your household from the actions the engine ranked. The checker in `shared/plan.ts` holds it to the same safety rules as the rule plan: never seal the house while an angithi burns, air rooms only in a clean window, and cover every sensitive person. A plan that breaks a rule gets one chance to fix it, and otherwise the rule plan stays. On Ask, it streams an answer grounded in today's forecast, your household and cited knowledge cards, and every claim links to its source. It never judges the air itself: the engine decides when to open the windows, and whether a walk or play outside is fine now, should wait for a window it names, or belongs indoors today. The model passes that on, and on an indoor day the engine adds its own indoor step if the model leaves one out. Questions can be spoken and answers read aloud, in English or Hindi. On Indoors, once you agree, it looks at a photo of a room and names what it sees from a fixed list: a stove with no chimney, incense, a mosquito coil, an angithi, an open window. The engine then ranks the fixes for that room. The photo is shrunk and stripped of its location data in your browser and never stored, and the same checklist works without one. On Community, it writes a WhatsApp message or a printed notice for a housing society, school or workplace.

The model only sees what it needs: your household without names, its place rounded to about 11 km, and figures the engine has already worked out. Any figure it writes that isn't in that data is caught, and the reply is either fixed or flagged on screen.

`just eval` scores the model on 40 cases across four households, on severe, clearing and clean days, in both languages, with a medical emergency, a prompt injection and five public-domain room photos, and saves its replies. Each reply is checked for what matters to the person reading it: the right language and script, short sentences, every figure from the data, a cited source, the engine's call on going outside, the window's hours or the indoor alternative, an answer that stays on the question asked, and none of the prompt read back. The latest run scored 100% on all 40 cases with gemini-3.5-flash-lite. `just check` scores those saved replies again, so a change that lowers the score fails the build. To run the AI yourself, put a free key from [AI Studio](https://aistudio.google.com/apikey) in `.env` as `GEMINI_API_KEY`; without one, everything else still works.

## Security, accessibility and tests

The Gemini key lives only in the host's environment. A Vercel firewall rule turns away more than 120 API requests a minute from one address at the edge, and behind it every route validates its input with zod under a body limit, checks the request's origin and has its own per-visitor limit, tighter on the model routes and keyed on the one address the platform vouches for, never a header a client can forge. The response headers in `server/headers.ts` set a strict Content-Security-Policy that enforces Trusted Types, HSTS, no framing and full cross-origin isolation. Model output is parsed against a schema, user text reaches the model fenced as data, and the evals include a prompt-injection case. CI runs CodeQL, gitleaks over the whole history and a dependency audit, and every Action is pinned to a commit. [docs/security.md](docs/security.md) has the threat model and the OWASP Top 10 for LLM applications, point by point; [SECURITY.md](SECURITY.md) says how to report a hole.

The app aims at WCAG 2.2 AA. CI runs axe on every page in light and dark themes, and again in Windows high contrast, and fails on any violation. Every AQI level carries a word and a number as well as a colour, the forecast chart has a table view, streamed answers are announced through a live region, the page's `lang` follows the chosen language, nothing moves when the system asks for less motion, and the layout holds at 320 px with a skip link and full keyboard use. [docs/accessibility.md](docs/accessibility.md) lists what's tested and what still needs a person with a screen reader.

`bun test` runs 351 unit, property, route and component tests against a fixture forecast and a scripted model, with no network. They cover 98.5% of lines, and 99.7% of the engine that produces every number; the build fails below 95% and 98%, or when any source file goes untested. `just e2e` runs 45 browser tests: the demo path, offline, Hindi, keyboard, the accessibility tree, the axe scans, and every page running under its CSP and Trusted Types without a single violation. GitHub Actions runs all of it, plus lint, types, the unused-code check, the build's JavaScript budget and the eval replay, on every push.

## Run it

```bash
bun install
bun run build
bun run start
```

Open http://localhost:8787 to set up your own household, or http://localhost:8787/?demo=meera for the demo. `just dev` runs the app with live reload, `just check` runs everything CI does, and `just e2e` runs the browser tests.

## What's next

A full pass with NVDA and TalkBack, and a native Hindi reader's review of the wording. Then a ground station source such as OpenAQ to anchor the current reading, since a 45 km forecast grid can miss a sharp local peak, and more of India's languages.

Air quality data: Copernicus Atmosphere Monitoring Service forecasts through [Open-Meteo](https://open-meteo.com/), CC BY 4.0.

## Licence

MIT. Engineered by Arjun Krishnan.
