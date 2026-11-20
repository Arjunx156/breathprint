import { logger } from "../log";
import { type Attempt, attemptSignal, classify, type Recorder, recorder, relay } from "./attempt";
import {
  type Failure,
  type LlmRequest,
  LlmUnavailable,
  type LogLine,
  type Provider,
} from "./types";

export type LlmOptions = {
  /** Null when nothing is configured: every call fails fast as "offline". */
  provider: Provider | null;
  /** Tried in order. Each Gemini model has its own free quota, so a 429 moves on. */
  models: readonly string[];
  /** How long one attempt may wait for its first words. */
  timeoutMs: number;
  /** Everything one call may spend across models and retries; under Vercel's 30 s. */
  budgetMs?: number;
  /** US dollars per million input and output tokens, for the log; 0 on the free tier. */
  price?: readonly [number, number];
  log?: (line: LogLine) => void;
  sleep?: (ms: number) => Promise<void>;
};

/** For scripted runs and recorders: log nowhere and never wait between retries. */
export const SILENT = {
  log: () => undefined,
  sleep: () => Promise.resolve(),
} as const satisfies Pick<LlmOptions, "log" | "sleep">;

export type Llm = {
  ready: boolean;
  generate(req: LlmRequest, signal?: AbortSignal): Promise<{ text: string; model: string }>;
  /** Resolves when the first words arrive, so a failure before then can still move on. */
  stream(
    req: LlmRequest,
    signal?: AbortSignal,
  ): Promise<{ model: string; chunks: AsyncIterable<string> }>;
};

const BUDGET_MS = 25_000;
const BACKOFF_MS = 400;

type Settings = Required<LlmOptions>;

const defaultLog = (line: LogLine) =>
  line.outcome === "ok" ? logger.info(line) : logger.warn(line);

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function settle(options: LlmOptions): Settings {
  return { budgetMs: BUDGET_MS, price: [0, 0], log: defaultLog, sleep: wait, ...options };
}

type Asked<T> = { ok: true; value: T } | { ok: false; failure: Failure };

/** What one attempt on one model has to work with. */
type Try = {
  provider: Provider;
  model: string;
  attempt: Attempt;
  record: Recorder;
  /** When the whole call's budget runs out, on the performance clock. */
  deadline: number;
};
type Ask<T> = (attempt: Try) => Promise<T>;

/** One call as it walks the model chain. */
type Call<T> = {
  settings: Settings;
  provider: Provider;
  req: LlmRequest;
  deadline: number;
  signal: AbortSignal | undefined;
  ask: Ask<T>;
};

/** One attempt on one model, with its own timeout and log line. */
async function once<T>(call: Call<T>, model: string, n: number): Promise<Asked<T>> {
  const { settings, provider, req, deadline, signal, ask } = call;
  const left = deadline - performance.now();
  if (left <= 0) return { ok: false, failure: "timeout" };
  const attempt = attemptSignal(Math.min(settings.timeoutMs, left), signal);
  const meter = { log: settings.log, price: settings.price, provider: provider.name };
  const record = recorder(meter, req, model, n);
  try {
    return { ok: true, value: await ask({ provider, model, attempt, record, deadline }) };
  } catch (err) {
    attempt.stop();
    if (signal?.aborted) throw err;
    const failure = classify(err, attempt.timedOut());
    record(failure);
    return { ok: false, failure };
  }
}

/** Up to two attempts on one model: the second only after a server error. */
async function onModel<T>(call: Call<T>, model: string): Promise<Asked<T>> {
  const first = await once(call, model, 1);
  if (first.ok || first.failure !== "unavailable") return first;
  await call.settings.sleep(BACKOFF_MS * (1 + Math.random()));
  return once(call, model, 2);
}

/** Tries each model in turn until one answers; a refused key ends the chain early. */
async function overChain<T>(
  settings: Settings,
  req: LlmRequest,
  signal: AbortSignal | undefined,
  ask: Ask<T>,
): Promise<{ value: T; model: string }> {
  const { provider, models, budgetMs } = settings;
  if (!provider || models.length === 0) throw new LlmUnavailable("offline");
  const deadline = performance.now() + budgetMs;
  const call: Call<T> = { settings, provider, req, deadline, signal, ask };
  let last: Failure = "unavailable";
  for (const model of models) {
    const asked = await onModel(call, model);
    if (asked.ok) return { value: asked.value, model };
    last = asked.failure;
    if (last === "refused") break;
  }
  throw new LlmUnavailable(last);
}

/** Asks for the whole reply at once. */
const whole =
  (req: LlmRequest): Ask<string> =>
  async ({ provider, model, attempt, record }) => {
    const reply = await provider.generate(model, req, attempt.signal);
    attempt.stop();
    record("ok", reply.usage);
    return reply.text;
  };

/** Waits only for the first words; the rest may take whatever the budget has left. */
const streamed =
  (req: LlmRequest): Ask<AsyncGenerator<string>> =>
  async ({ provider, model, attempt, record, deadline }) => {
    const source = provider.stream(model, req, attempt.signal)[Symbol.asyncIterator]();
    const first = await source.next();
    attempt.arm(Math.max(1, deadline - performance.now()));
    return relay(source, first, attempt, record);
  };

/**
 * Asks the configured models in order with a timeout on every attempt. A
 * server error gets one retry after a short pause; a 429 or a timeout moves
 * straight to the next model; a refused key stops. Each attempt logs one
 * line with the model, outcome, tokens, time and cost, and never the text.
 */
export function createLlm(options: LlmOptions): Llm {
  const settings = settle(options);
  return {
    ready: settings.provider !== null && settings.models.length > 0,
    generate: async (req, signal) => {
      const { value, model } = await overChain(settings, req, signal, whole(req));
      return { text: value, model };
    },
    stream: async (req, signal) => {
      const { value, model } = await overChain(settings, req, signal, streamed(req));
      return { model, chunks: value };
    },
  };
}
