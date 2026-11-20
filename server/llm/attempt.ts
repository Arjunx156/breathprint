import {
  type Chunk,
  type Failure,
  type LlmRequest,
  LlmUnavailable,
  type LogLine,
  ProviderError,
  type Usage,
} from "./types";

/*
 * One attempt on one model: its timer, what its failure means, and its log
 * line. The chain in llm.ts decides what to try next.
 */

/** Where an attempt's log line goes, and what its tokens cost. */
export type Meter = {
  log: (line: LogLine) => void;
  /** US dollars per million input and output tokens. */
  price: readonly [number, number];
  provider: string;
};

/** What a failed attempt means for the next one. */
export function classify(err: unknown, timedOut: boolean): Failure {
  if (timedOut) return "timeout";
  if (!(err instanceof ProviderError)) return "unavailable";
  if (err.status === 429) return "quota";
  // A bad or missing key fails the same way on every model; stop asking.
  if (err.status === 401 || err.status === 403) return "refused";
  return "unavailable";
}

/** Aborts one attempt when its time is up or the caller hangs up, and knows which it was. */
export function attemptSignal(ms: number, outer?: AbortSignal) {
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

/** One attempt's abort signal and timer. */
export type Attempt = ReturnType<typeof attemptSignal>;
/** Writes the attempt's one log line, once it knows how it ended. */
export type Recorder = (outcome: "ok" | Failure, usage?: Usage) => void;

/** One log line per attempt: model, outcome, tokens, time and cost, and never the text. */
export function recorder(meter: Meter, req: LlmRequest, model: string, attempt: number): Recorder {
  const started = performance.now();
  return (outcome, usage = { input: 0, output: 0 }) => {
    const usd = (usage.input * meter.price[0] + usage.output * meter.price[1]) / 1e6;
    meter.log({
      llm: req.job,
      provider: meter.provider,
      model,
      attempt,
      outcome,
      ms: Math.round(performance.now() - started),
      in: usage.input,
      out: usage.output,
      usd: Number(usd.toFixed(6)),
    });
  };
}

/** Passes a stream on piece by piece and logs once, however it ends. */
export async function* relay(
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
    throw new LlmUnavailable(reason, { cause: err });
  } finally {
    attempt.stop();
  }
}
