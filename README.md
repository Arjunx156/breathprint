# Breathprint

Every choice leaves a breathprint.

Breathprint turns tomorrow's smog forecast into a plan for your family: when to air the house, which room to filter tonight, which trips to change and who needs a mask. Every step shows what it does for the air your family breathes, the air your street shares and your wallet, with the formula and the source one tap away.

It is being built for PromptWars 6. Today the forecast, the rule-based plan, the impact numbers and the full interface in English and Hindi all work. The Gemini planner, chat, room scan and community advisories are next.

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

Air quality data: Copernicus Atmosphere Monitoring Service forecasts through [Open-Meteo](https://open-meteo.com/), CC BY 4.0.

## Licence

MIT. Engineered by Arjun Krishnan.
