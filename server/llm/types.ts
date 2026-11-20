/** A photo sent with a turn, base64 without the data: prefix. Never logged. */
export type InlineImage = { mime: "image/jpeg"; data: string };

/** One message in a conversation; "model" is the assistant's side. */
export type Turn = { role: "user" | "model"; text: string; images?: readonly InlineImage[] };

/** One request to a model, the same for every provider. */
export type LlmRequest = {
  /** Which job is asking, for the log line: plan, chat, advisory. */
  job: string;
  system: string;
  turns: readonly Turn[];
  /** A JSON Schema the reply must follow; plain text when absent. */
  schema?: Record<string, unknown>;
  maxTokens: number;
  temperature: number;
};

/** Tokens in and out, for the log line. */
export type Usage = { input: number; output: number };

/** Some text from a model, with token counts when the provider reports them. */
export type Chunk = { text: string; usage?: Usage };

/** How one provider asks one model. Failures are thrown as ProviderError. */
export type Provider = {
  name: "gemini" | "ollama" | "fake";
  generate(model: string, req: LlmRequest, signal: AbortSignal): Promise<Chunk>;
  stream(model: string, req: LlmRequest, signal: AbortSignal): AsyncIterable<Chunk>;
};

/** A provider failure with the HTTP status that explains it; 0 when the network failed. */
export class ProviderError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

/** Why a model call failed, which decides whether to retry, move on or stop. */
export type Failure = "offline" | "quota" | "timeout" | "unavailable" | "refused";

/** No model could answer. Routes catch this and fall back to the engine's own answer. */
export class LlmUnavailable extends Error {
  readonly reason: Failure;

  constructor(reason: Failure, options?: ErrorOptions) {
    super(`model unavailable: ${reason}`, options);
    this.name = "LlmUnavailable";
    this.reason = reason;
  }
}

/** One structured log line; values only, never a prompt or a reply. */
export type LogLine = Record<string, string | number | boolean>;
