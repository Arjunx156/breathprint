/** One message in a conversation; "model" is the assistant's side. */
export type Turn = { role: "user" | "model"; text: string };

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
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
