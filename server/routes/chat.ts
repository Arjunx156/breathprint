import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import type { Language } from "../../shared/profile";
import { type ChatEvent, MAX_CHARS, MAX_MESSAGES } from "../../shared/replies";
import { chatRequest } from "../ai/chat";
import { contextFor } from "../ai/grounding";
import { ungrounded } from "../ai/guard";
import { recorded } from "../ai/recorded";
import type { AirSource } from "../air/source";
import type { Llm } from "../llm/llm";
import { valid } from "../validate";
import { AiBody } from "./plan";

const ChatBody = AiBody.extend({
  messages: z
    .array(
      z.object({ role: z.enum(["user", "model"]), text: z.string().trim().min(1).max(MAX_CHARS) }),
    )
    .min(1)
    .max(MAX_MESSAGES)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be a question."),
});

async function* once(text: string) {
  yield text;
}

/** The live answer, or in demo mode a saved one for the same question when the model is out. */
async function answer(llm: Llm, req: Parameters<Llm["stream"]>[0], saved: string | undefined) {
  try {
    return { ...(await llm.stream(req)), recorded: false };
  } catch (err) {
    if (!saved) throw err;
    return { model: "recorded", chunks: once(saved), recorded: true };
  }
}

const savedKey = (lang: Language, question: string) => `chat:${lang}:${question}`;

export function chatRoutes({ llm, air }: { llm: Llm; air: AirSource }) {
  return new Hono().post("/", valid("json", ChatBody), async (c) => {
    const { profile, lang, demo, messages } = c.req.valid("json");
    const ctx = await contextFor(air, profile, demo);
    const call = chatRequest(ctx, messages, lang);
    const question = messages.at(-1)?.text ?? "";
    const saved = demo && messages.length === 1 ? recorded(savedKey(lang, question)) : undefined;
    // Fails here, before any bytes are sent, when no model answers; the
    // browser then shows the matching cards on its own.
    const reply = await answer(llm, call.req, saved);

    c.header("Content-Type", "application/x-ndjson; charset=utf-8");
    return stream(c, async (out) => {
      const send = (event: ChatEvent) => out.write(`${JSON.stringify(event)}\n`);
      let text = "";
      try {
        for await (const piece of reply.chunks) {
          text += piece;
          await send({ type: "text", text: piece });
        }
        const flags = ungrounded(text, call.allowed);
        await send({ type: "done", model: reply.model, recorded: reply.recorded, flags });
      } catch {
        await send({ type: "error" });
      }
    });
  });
}
