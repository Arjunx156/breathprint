import {
  ApiError,
  type GenerateContentConfig,
  type GenerateContentResponse,
  GoogleGenAI,
} from "@google/genai";
import { type Chunk, type LlmRequest, type Provider, ProviderError, type Usage } from "./types";

function usage(res: GenerateContentResponse): Usage | undefined {
  const m = res.usageMetadata;
  if (!m) return undefined;
  // Thinking tokens are billed as output.
  return {
    input: m.promptTokenCount ?? 0,
    output: (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0),
  };
}

function asProviderError(err: unknown): ProviderError {
  if (err instanceof ApiError) return new ProviderError(err.status, `gemini ${err.status}`);
  return new ProviderError(0, err instanceof Error ? err.name : "gemini request failed");
}

function chunk(res: GenerateContentResponse): Chunk {
  const u = usage(res);
  return u ? { text: res.text ?? "", usage: u } : { text: res.text ?? "" };
}

/** Gemini through Google's own SDK. The chain in llm.ts owns retries, so the SDK makes one attempt. */
export function gemini(apiKey: string): Provider {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });

  const request = (model: string, req: LlmRequest, signal: AbortSignal) => {
    const config: GenerateContentConfig = {
      systemInstruction: req.system,
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
      abortSignal: signal,
    };
    if (req.schema) {
      config.responseMimeType = "application/json";
      config.responseJsonSchema = req.schema;
    }
    const contents = req.turns.map((t) => ({
      role: t.role,
      parts: [
        ...(t.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } })),
        { text: t.text },
      ],
    }));
    return { model, contents, config };
  };

  return {
    name: "gemini",
    async generate(model, req, signal) {
      try {
        return chunk(await ai.models.generateContent(request(model, req, signal)));
      } catch (err) {
        throw asProviderError(err);
      }
    },
    async *stream(model, req, signal) {
      try {
        for await (const res of await ai.models.generateContentStream(
          request(model, req, signal),
        )) {
          yield chunk(res);
        }
      } catch (err) {
        throw asProviderError(err);
      }
    },
  };
}
