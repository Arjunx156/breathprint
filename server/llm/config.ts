import type { Env } from "../env";
import { gemini } from "./gemini";
import { createLlm, type Llm, type LlmOptions } from "./llm";
import { ollama } from "./ollama";

/**
 * Model chains, cheapest first, used when LLM_MODELS is empty. Each Gemini
 * model has its own free-tier quota, so a 429 on one falls through to the next.
 */
export const DEFAULT_MODELS: Record<Env["LLM_PROVIDER"], readonly string[]> = {
  gemini: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  ollama: ["gemma3:4b"],
  fake: [],
};

function provider(env: Env) {
  if (env.LLM_PROVIDER === "ollama") return ollama(env.OLLAMA_HOST);
  if (env.LLM_PROVIDER === "gemini" && env.GEMINI_API_KEY) return gemini(env.GEMINI_API_KEY);
  return null;
}

/** The model chain this deployment is configured for; offline when nothing is. */
export function llmFromEnv(env: Env, log?: LlmOptions["log"]): Llm {
  if (env.LLM_PROVIDER === "gemini" && !env.GEMINI_API_KEY) {
    console.warn(
      JSON.stringify({ level: "warn", message: "GEMINI_API_KEY is not set; AI is off" }),
    );
  }
  return createLlm({
    provider: provider(env),
    models: env.LLM_MODELS.length > 0 ? env.LLM_MODELS : DEFAULT_MODELS[env.LLM_PROVIDER],
    timeoutMs: env.LLM_TIMEOUT_MS,
    price: env.LLM_PRICE_PER_MTOK,
    ...(log ? { log } : {}),
  });
}
