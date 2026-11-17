# Breathprint

Every choice leaves a breathprint.

Breathprint turns tomorrow's smog forecast into a plan for your family: when to air the house, which room to filter tonight, which trips to change and who needs a mask. Every step shows what it does for the air your family breathes, the air your street shares and your wallet, with the formula and the source one tap away.

It is being built for PromptWars 6. The forecast, the rule-based plan, the impact numbers, Gemini's personal plan, the Ask page and the community advisories all work, in English and Hindi. The room scan is next.

![Breathprint](web/public/og.png)

## Run it

```bash
bun install
bun run build
bun run start
```

Open http://localhost:8787 to set up your own household, or http://localhost:8787/?demo=meera for Meera's family in Delhi on a severe winter morning. `just dev` runs the app with live reload, and `just check` runs lint, types, tests and the build.

## How it works

The model may choose and explain, but it never calculates. Every number on screen comes from `shared/`, a tested TypeScript engine that runs in the browser and on the server: AQI on the India and US scales, indoor and travel exposure, emissions, and each action's effect as a range with a cited source in `shared/sources.ts`. Because the engine runs on the device, a checked plan appears instantly and still works offline.

`server/` is a small Hono API that fetches CAMS forecasts and place search from Open-Meteo, caches them, and rounds every location to 0.1 degree. `web/` is the React app. Your household stays in your browser; there are no accounts and no database.

## Gemini

Gemini has three jobs, and each one sits behind an answer the engine already gave, so the app never waits on the model or goes blank without it. On Today, once you agree, it writes a plan for your household from the actions the engine ranked. The checker in `shared/plan.ts` holds it to the same safety rules as the rule plan: never seal the house while an angithi burns, air rooms only in a clean window, and cover every sensitive person. A plan that breaks a rule gets one chance to fix it, and otherwise the rule plan stays. On Ask, it streams an answer grounded in today's forecast, your household and cited knowledge cards, and every claim links to its source. It never judges the air itself: the engine decides whether a walk or play outside is fine now, should wait for a window it names, or belongs indoors today, and the model passes that on with an indoor alternative. On Community, it writes a WhatsApp message or a printed notice for a housing society, school or workplace.

The model only sees what it needs: your household without names, its place rounded to about 11 km, and figures the engine has already worked out. Any figure it writes that isn't in that data is caught, and the reply is either fixed or flagged on screen.

`just eval` scores the model on 35 cases across four households, on severe, clearing and clean days, in both languages, with a medical emergency and a prompt injection, and saves its replies. Each reply is checked for what matters to the person reading it: the right language and script, short sentences, every figure from the data, a cited source, the engine's call on going outside, the window's hours or the indoor alternative, and none of the prompt read back. The latest run scored 99.0% on gemini-3.1-flash-lite, the smaller fallback model, after the main model's free daily quota ran out. `just check` scores those saved replies again, so a change that lowers the score fails the build. To run the AI yourself, put a free key from [AI Studio](https://aistudio.google.com/apikey) in `.env` as `GEMINI_API_KEY`; without one, everything else still works.

Air quality data: Copernicus Atmosphere Monitoring Service forecasts through [Open-Meteo](https://open-meteo.com/), CC BY 4.0.

## Licence

MIT. Engineered by Arjun Krishnan.
