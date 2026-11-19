import { advisoryRequest, readAdvisory } from "../server/ai/advisory";
import { chatRequest } from "../server/ai/chat";
import { contextFor } from "../server/ai/grounding";
import { ungrounded } from "../server/ai/guard";
import { personalPlan } from "../server/ai/planner";
import { readScan, scanRequest } from "../server/ai/scan";
import { structured } from "../server/ai/structured";
import { fixtureSource } from "../server/air/fixture";
import { loadEnv } from "../server/env";
import { llmFromEnv } from "../server/llm/config";
import { SILENT } from "../server/llm/llm";
import { photoId } from "../server/routes/scan";
import { AUDIENCES, CHANNELS, collective, typicalHousehold } from "../shared/community";
import { t } from "../shared/i18n";
import { LANGUAGES, MEERA } from "../shared/profile";
import { HOUSEHOLDS } from "./jobs";
import { knownIds } from "./scorers";

/*
 * Saves real answers for the demo day into server/ai/recorded.json, so
 * `?demo=meera` still shows the model's words when the network or the quota
 * fails on stage. Only answers that pass every check are kept, and the
 * server checks each one again before it shows it.
 */

const OUT = "server/ai/recorded.json";
const QUESTIONS = ["ask.q1", "ask.q2", "ask.q3"] as const;
const SAMPLE_PHOTO = "web/public/samples/kitchen.jpg";

const env = loadEnv();
if (env.LLM_PROVIDER === "fake") {
  console.error("No model is configured. Set GEMINI_API_KEY in .env, or LLM_PROVIDER=ollama.");
  process.exit(1);
}
const llm = llmFromEnv(env, SILENT.log);
const air = fixtureSource();
const delayMs = Number(process.env.EVAL_DELAY_MS ?? 4000);
// Merged into what is there, so a run cut short by the quota loses nothing.
const saved: Record<string, string> = await Bun.file(OUT).json();
let first = true;

/** Runs one recording, paced for the free tier, and reports it without stopping the rest. */
async function take(key: string, get: () => Promise<string | null>) {
  if (!first) await Bun.sleep(delayMs);
  first = false;
  try {
    const text = await get();
    if (text === null) console.error(`skipped ${key}: the answer failed a check`);
    else saved[key] = text;
  } catch (err) {
    console.error(`skipped ${key}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

for (const lang of LANGUAGES) {
  await take(`plan:${lang}`, async () => {
    const { value } = await personalPlan(llm, await contextFor(air, MEERA, true), lang);
    return JSON.stringify({ headline: value.headline, steps: value.steps });
  });

  for (const key of QUESTIONS) {
    const question = t(lang, key);
    await take(`chat:${lang}:${question}`, async () => {
      const ctx = await contextFor(air, MEERA, true);
      const call = chatRequest(ctx, [{ role: "user", text: question }], lang);
      const reply = await llm.stream(call.req);
      let text = "";
      for await (const piece of reply.chunks) text += piece;
      const clean = ungrounded(text, call.allowed).length === 0 && knownIds(text).pass;
      return clean ? text : null;
    });
  }

  // The sample photo the demo offers, filed under its own hash as the route looks it up.
  const sample = new Uint8Array(await Bun.file(SAMPLE_PHOTO).arrayBuffer());
  await take(`scan:${lang}:${photoId(sample)}`, async () => {
    const image = { mime: "image/jpeg" as const, data: Buffer.from(sample).toString("base64") };
    const { value } = await structured(llm, scanRequest(image, lang), readScan(lang));
    return JSON.stringify(value);
  });

  for (const audience of AUDIENCES) {
    for (const channel of CHANNELS) {
      await take(`advisory:${lang}:${audience}:${channel}`, async () => {
        const ctx = await contextFor(air, typicalHousehold(MEERA.place, audience), true);
        const together = collective(ctx.air, ctx.profile.place, audience, HOUSEHOLDS);
        const call = advisoryRequest(ctx, { audience, channel, lang }, together);
        const { value } = await structured(llm, call.req, readAdvisory(call));
        return JSON.stringify(value);
      });
    }
  }
}

const sorted = Object.fromEntries(Object.entries(saved).sort(([a], [b]) => a.localeCompare(b)));
await Bun.write(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
console.info(`Saved ${Object.keys(sorted).length} answers to ${OUT}.`);
