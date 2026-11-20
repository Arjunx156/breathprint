import { z } from "zod";
import { issueLines } from "./issues";

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

/** A header the proxy in front overwrites with the visitor's address, such as fly-client-ip. */
const ipHeader = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,64}$/, "a header name")
  .refine(
    (h) => h.toLowerCase() !== "x-forwarded-for",
    "x-forwarded-for starts with whatever the client sent; name a header the proxy overwrites",
  );

/** "0.10,0.40": dollars per million input and output tokens. */
const price = z
  .string()
  .default("0,0")
  .transform((s) => s.split(",").map(Number))
  .pipe(z.tuple([z.number().min(0), z.number().min(0)]));

/** Every setting the server reads, validated at boot with safe defaults. */
export const EnvSchema = z
  .object({
    LLM_PROVIDER: optional(z.enum(["gemini", "ollama", "fake"])),
    LLM_MODELS: list,
    GEMINI_API_KEY: optional(z.string().min(20)),
    OLLAMA_HOST: z.url().default("http://127.0.0.1:11434"),
    LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(12_000),
    LLM_PRICE_PER_MTOK: price,
    RATE_LIMIT_AI_PER_MIN: positiveInt(8),
    RATE_LIMIT_PER_MIN: positiveInt(60),
    ALLOWED_ORIGINS: list,
    TRUSTED_IP_HEADER: optional(ipHeader),
    AIR_SOURCE: z.enum(["open-meteo", "fixture"]).default("open-meteo"),
    PORT: positiveInt(8787),
  })
  // Setting a key is enough to turn Gemini on; without one the model routes stay offline.
  .transform((env) => ({
    ...env,
    LLM_PROVIDER: env.LLM_PROVIDER ?? (env.GEMINI_API_KEY ? "gemini" : "fake"),
  }));

export type Env = z.infer<typeof EnvSchema>;

/**
 * Reads and validates configuration once at boot. A bad value stops the
 * server with the variable's name; the key itself is never printed.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const fields = issueLines(parsed.error.issues, "env").join("; ");
  throw new Error(`Invalid configuration. ${fields}`);
}
