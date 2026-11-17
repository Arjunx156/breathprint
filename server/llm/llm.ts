import { type Chunk, type LlmRequest, type Provider, ProviderError, type Usage } from "./types";

export type Failure = "offline" | "quota" | "timeout" | "unavailable" | "refused";

/** No model could answer. Routes catch this and fall back to the engine's own answer. */
export class LlmUnavailable extends Error {
  constructor(readonly reason: Failure) {
    super(`model unavailable: ${reason}`);
    this.name = "LlmUnavailable";
  }
}

export type LogLine = Record<string, string | number | boolean>;

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

/** What a failed attempt means for the next one. */
export function classify(err: unknown, timedOut: boolean): Failure {
  if (timedOut) return "timeout";
  if (!(err instanceof ProviderError)) return "unavailable";
  if (err.status === 429) return "quota";
  // A bad or missing key fails the same way on every model; stop asking.
  if (err.status === 401 || err.status === 403) return "refused";
  return "unavailable";
}

const defaultLog = (line: LogLine) =>
  console.info(JSON.stringify({ level: line.outcome === "ok" ? "info" : "warn", ...line }));

/** Aborts one attempt when its time is up or the caller hangs up, and knows which it was. */
function attemptSignal(ms: number, outer?: AbortSignal) {
  const controller = new AbortController();
  let fired = false;
  let id: ReturnType<typeof setTimeout> | undefined;
  const arm = (after: number) => {
    clearTimeout(id);
    id = setTimeout(() => {
      fired = true;
      controller.abort();
    }, after);
  };
  const onOuter = () => controller.abort();
  outer?.addEventListener("abort", onOuter, { once: true });
  arm(ms);
  return {
    signal: controller.signal,
    timedOut: () => fired,
    arm,
    stop: () => {
      clearTimeout(id);
      outer?.removeEventListener("abort", onOuter);
      controller.abort();
    },
  };
}

type Attempt = ReturnType<typeof attemptSignal>;
type Recorder = (outcome: "ok" | Failure, usage?: Usage) => void;
type Asked<T> = { ok: true; value: T } | { ok: false; failure: Failure };

/** Passes a stream on piece by piece and logs once, however it ends. */
async function* relay(
  source: AsyncIterator<Chunk>,
  first: IteratorResult<Chunk>,
  attempt: Attempt,
  record: Recorder,
): AsyncGenerator<string> {
  let usage: Usage | undefined;
  try {
    let next = first;
    while (!next.done) {
      usage = next.value.usage ?? usage;
      if (next.value.text) yield next.value.text;
      next = await source.next();
    }
    record("ok", usage);
  } catch (err) {
    const reason = classify(err, attempt.timedOut());
    record(reason, usage);
    throw new LlmUnavailable(reason);
  } finally {
    attempt.stop();
  }
}

/**
 * Asks the configured models in order with a timeout on every attempt. A
 * server error gets one retry after a short pause; a 429 or a timeout moves
 * straight to the next model; a refused key stops. Each attempt logs one
 * line with the model, outcome, tokens, time and cost, and never the text.
 */
export function createLlm({
  provider,
  models,
  timeoutMs,
  budgetMs = BUDGET_MS,
  price = [0, 0],
  log = defaultLog,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}: LlmOptions): Llm {
  const recorder =
    (req: LlmRequest, model: string, attempt: number, started: number): Recorder =>
    (outcome, usage) => {
      const tokens = usage ?? { input: 0, output: 0 };
      const usd = (tokens.input * price[0] + tokens.output * price[1]) / 1e6;
      log({
        llm: req.job,
        provider: provider?.name ?? "none",
        model,
        attempt,
        outcome,
        ms: Math.round(performance.now() - started),
        in: tokens.input,
        out: tokens.output,
        usd: Number(usd.toFixed(6)),
      });
    };

  type Ask<T> = (
    p: Provider,
    model: string,
    attempt: Attempt,
    record: Recorder,
    deadline: number,
  ) => Promise<T>;

  type Call<T> = {
    p: Provider;
    req: LlmRequest;
    model: string;
    deadline: number;
    signal: AbortSignal | undefined;
    ask: Ask<T>;
  };

  /** One attempt, with its own timeout and log line. */
  async function once<T>({ p, req, model, deadline, signal, ask }: Call<T>, n: number) {
    const left = deadline - performance.now();
    if (left <= 0) return { ok: false, failure: "timeout" } as const;
    const attempt = attemptSignal(Math.min(timeoutMs, left), signal);
    const record = recorder(req, model, n, performance.now());
    try {
      return { ok: true, value: await ask(p, model, attempt, record, deadline) } as const;
    } catch (err) {
      attempt.stop();
      if (signal?.aborted) throw err;
      const failure = classify(err, attempt.timedOut());
      record(failure);
      return { ok: false, failure } as const;
    }
  }

  /** Up to two attempts on one model: the second only after a server error. */
  async function onModel<T>(call: Call<T>): Promise<Asked<T>> {
    const first = await once(call, 1);
    if (first.ok || first.failure !== "unavailable") return first;
    await sleep(BACKOFF_MS * (1 + Math.random()));
    return once(call, 2);
  }

  async function overChain<T>(req: LlmRequest, signal: AbortSignal | undefined, ask: Ask<T>) {
    if (!provider || models.length === 0) throw new LlmUnavailable("offline");
    const deadline = performance.now() + budgetMs;
    let last: Failure = "unavailable";
    for (const model of models) {
      const asked = await onModel({
        p: provider,
        req,
        model,
        deadline,
        signal,
        ask: (...args) => ask(...args).then((value) => ({ value, model })),
      });
      if (asked.ok) return asked.value;
      last = asked.failure;
      if (last === "refused") break;
    }
    throw new LlmUnavailable(last);
  }

  return {
    ready: provider !== null && models.length > 0,

    generate: async (req, signal) => {
      const { value, model } = await overChain(req, signal, async (p, m, attempt, record) => {
        const reply = await p.generate(m, req, attempt.signal);
        attempt.stop();
        record("ok", reply.usage);
        return reply.text;
      });
      return { text: value, model };
    },

    stream: async (req, signal) => {
      const { value, model } = await overChain(req, signal, async (p, m, attempt, record, end) => {
        const source = p.stream(m, req, attempt.signal)[Symbol.asyncIterator]();
        const first = await source.next();
        // The first words are in; the rest may take whatever the budget has left.
        attempt.arm(Math.max(1, end - performance.now()));
        return relay(source, first, attempt, record);
      });
      return { model, chunks: value };
    },
  };
}
