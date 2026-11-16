import { z } from "zod";

/** Empty strings from a .env file mean "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const list = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

export const EnvSchema = z.object({
  LLM_PROVIDER: z.enum(["gemini", "ollama", "fake"]).default("fake"),
  LLM_MODELS: list,
  GEMINI_API_KEY: optional(z.string().min(20)),
  OLLAMA_HOST: z.url().default("http://127.0.0.1:11434"),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),
  RATE_LIMIT_AI_PER_MIN: positiveInt(8),
  RATE_LIMIT_PER_MIN: positiveInt(60),
  ALLOWED_ORIGINS: list,
  AIR_SOURCE: z.enum(["open-meteo", "fixture"]).default("open-meteo"),
  PORT: positiveInt(8787),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Reads and validates configuration once at boot. A bad value stops the
 * server with the variable's name; the key itself is never printed.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const fields = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid configuration. ${fields}`);
}
