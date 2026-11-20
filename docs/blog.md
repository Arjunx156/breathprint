# Take the decision out of the prompt

_What building Breathprint, a smog-season assistant for families, taught me about small models._

![Breathprint: every choice leaves a breathprint. A 48-hour smog forecast drawn as coloured bars.](https://breathprint-zeta.vercel.app/og.png)

It's 8 in the morning in Rohini, Delhi, and the India AQI reads 417. Severe. Meera has a nine-year-old with asthma, a school run to make, and the children's grandmother, Dadi, who never misses her morning walk.

The air apps on Meera's phone give her the number and paint it maroon. They don't tell her whether Dadi should walk, when to open the windows, or which mask actually works for the walk to school. That gap is what PromptWars 6 asked for: a GenAI assistant that helps families and communities get through winter smog, suggests low-emission routines and indoor fixes, and explains the direct impact of each choice.

So I built Breathprint. Its line is "every choice leaves a breathprint", and it's live at [breathprint-zeta.vercel.app](https://breathprint-zeta.vercel.app). Open [the demo](https://breathprint-zeta.vercel.app/?demo=meera) to see Meera's morning.

## What it does

Breathprint turns the CAMS forecast for your neighbourhood into a plan for the day. On Meera's morning it moves the morning workout indoors, takes the agarbatti out to the balcony, puts N95s on the walk to school, works from home if she can, keeps the children's play inside and builds a box-fan purifier for the bedroom tonight.

Every step carries two ledgers. Protect is what it does for the air your family breathes. Prevent is what it keeps out of the air your street shares. Tap a step and you get its numbers as a range, with the formula behind them and the source. The Ask page answers questions in English or Hindi, typed or spoken, and reads the answer aloud. The Indoors page takes a photo of a room: Gemini names what it sees from a fixed list, a stove with no chimney or a burning coil, and the engine ranks the fixes for that room. The Community page writes a WhatsApp message or a printed notice for a housing society, a school or a workplace, along with what 120 households doing the same thing would keep out of the air.

## The model chooses, the engine counts

The first rule I wrote down shaped everything after it: Gemini may choose and explain, but it never calculates.

A smog assistant that invents "cuts your exposure by 80%" is worse than no assistant at all. So every number on screen comes from `shared/`, a plain TypeScript engine with no I/O. It does AQI on the India and US scales, NowCast, an indoor mass-balance model, exposure while travelling and emissions, across 27 actions and 27 cited sources. The same code runs in the browser and on the server. That means a rule-checked plan is on screen the moment the forecast arrives, and Gemini's personal plan shows up a beat later behind a "Personalised plan ready" button. If the model is slow, rate-limited or down, the page never goes blank.

The model works inside a fence the engine builds. It gets the household without names and the place rounded to 0.1 degree, about 11 km, which loses nothing against a forecast grid of about 45 km. It picks from a ranked list of actions, never from its imagination. A checker then holds its plan to the same safety rules as the rule plan: never seal the house while an angithi burns, air rooms only inside a clean window, and cover everyone who is sensitive. A plan that breaks a rule gets one chance to fix it. After that, the rule plan stays. Any figure in a reply that the engine never gave is caught and flagged.

## Evals are the spec

The code has 353 unit, property, route and component tests, and they cover 99.8% of the engine's lines. The model has an eval: 40 cases across four households, on severe, clearing and clean days, in both languages, plus a medical emergency, a prompt injection and five public-domain room photos. No case expects an exact string. Each one checks properties a family would care about. Is it the right language and script? Are the sentences short? Is every figure from the data? Is there a source, the hours of the clean window, or something to do indoors instead? Does it stay on the question? Does it read the prompt back?

`just eval` scores the live model and saves its replies. `just check`, and CI on every push, scores those saved replies again, so a change that lowers the score fails the build like a broken test.

The prompts went through fifteen versions in a single day. Most versions came from a failure the evals caught, and the fixes kept pointing the same way.

## What the evals caught

### It judged the air itself

I gave the model the forecast and a true-or-false flag for whether exercise outside was safe. On a severe day it still suggested exercising outdoors, which is exactly the kindly, wrong answer a family doesn't need. So the engine now makes the call, using the same limit the plan checker enforces, and hands it over as words:

```ts
export type Outdoors =
  | { kind: "now" }
  | { kind: "wait"; hours: Hours }
  | { kind: "indoors"; tomorrow: Hours | null };
```

The model reads "indoors all day today" or "wait until 12:00 to 17:00 today". It never sees a threshold to weigh.

### It blended its examples

I showed it one answer for a day that clears and one for an indoor day, and it stitched the two together into answers that said wait and stay in at once. So the prompt now carries only the example for the case the engine called today. The example's hours are 13:00 to 16:00, which no test day uses, so a copied time shows up in the evals instead of passing as right.

### It read the rules aloud

One reply ended with "and suggest no outing, however short", word for word from the instructions. Now a scorer flags any six-word run a reply shares with the rules.

### It answered Hindi in English

An English example pulled a Hindi question into an English answer, and once a whole Hindi plan came back in English. The examples now come in the reply's language, and a plan or advisory in the wrong script goes back for one rewrite before anyone sees it.

### It carried habits between topics

A "Not today:" opener I wrote for walks turned up in answers about masks. It also treated the walk to school as exercise. The rules now spell out that a trip that has to happen isn't exercise, and which topics the verdict stays out of.

### The eval said 100% while the demo was wrong

This one stung. After a run scored 100%, I read the saved demo answers. The first suggested question, "Can the children play outside today?", got "The air is too heavy for a walk today", in English and in Hindi, plus a note about opening the windows. Nothing checked for it, so nothing failed. A score only covers what you measure. Play now has its own example, and a new check catches answers that wander into a neighbouring topic.

### It left out the step that matters most

On an indoor day, "no" isn't an answer until it comes with something to do. The model kept leaving the indoor alternative out, run after run. I could have kept tuning the prompt. Instead, the engine adds the step when an answer about an outing doesn't offer one:

```ts
export function indoorStep(ctx: Context, text: string): string {
  if (!Object.values(outdoorCalls(ctx)).some((call) => call.kind === "indoors")) return "";
  const cited = markers(text);
  const steps = Object.values(INDOOR_STEP);
  if (cited.actions.some((id) => steps.includes(id))) return "";
  const offered = new Set(optionsFor(ctx).map((c) => c.action.id));
  const step = cited.cards.map((id) => INDOOR_STEP[id]).find((id) => id && offered.has(id));
  return step ? ` [A:${step}]` : "";
}
```

On the live site today, Gemini answered Dadi's question without the step, and the page still showed "Move the workout indoors".

Every one of these fixes is the same move. When the model gets a judgement wrong, stop asking it to make that judgement. Move the decision into code you can test, and let the model do what it does well: explain, in plain words, in the family's own language.

The latest run scored 100% on all 40 cases with gemini-3.5-flash-lite.

## Built on a free tier

The whole thing runs on free tiers, and the budget showed. Each Gemini model has its own daily quota, so the app falls through a chain, from gemini-3.5-flash-lite to gemini-3.1-flash-lite and then to the engine's own answer. Partway through a day of eval runs the main model's quota ran out, and the fallback model kept the score at 99%. For a demo on a bad connection, `?demo=meera` replays a fixed forecast and saved Gemini answers, and labels them as saved.

## Checked like code

Accessibility gets the same treatment as the model, with a check that runs in CI. axe scans every page in light and dark themes, and again in Windows high contrast, and fails the build on any WCAG 2.2 AA violation. That last scan caught something real: in high contrast the chosen option in a row of choices looked exactly like the others, so it now takes the system's own selection colours. Every AQI level has a word and a number beside its colour, the chart has a table view, streamed answers are announced to screen readers, and the page's language attribute follows the chosen language. The first screen loads 111.5 KB of gzipped JavaScript, under a 120 KB budget the build enforces, and after one visit the whole app opens with no signal.

## What's next

A full pass with NVDA and TalkBack, which the automated checks can't replace, and a native Hindi reader's review of the wording. Then a ground station source to anchor the current reading, since a 45 km forecast grid can miss a sharp local peak.

Meera can't change Delhi's air tonight. She can change her family's breathprint.

_Breathprint is open source at [github.com/Arjunx156/breathprint](https://github.com/Arjunx156/breathprint). Air quality data is from the Copernicus Atmosphere Monitoring Service, through Open-Meteo. Built for PromptWars 6._
