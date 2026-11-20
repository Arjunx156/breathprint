import { z } from "zod/mini";
import { AdvisorySchema, CollectiveSchema } from "./community";

/*
 * What the chat and advisory routes answer. The server builds these and the
 * browser checks them again, so a proxy or a stale deploy can't slip a bad
 * shape in. The plan's reply lives beside the plan in plan.ts.
 */

/** Six exchanges is enough memory for a question and its follow-ups. */
export const MAX_MESSAGES = 12;
/** The longest chat message the server accepts. */
export const MAX_CHARS = 600;

/** One line of the chat stream. */
export const ChatEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    model: z.string(),
    recorded: z.boolean(),
    flags: z.array(z.string()),
  }),
  z.object({ type: z.literal("error") }),
]);

export type ChatEvent = z.infer<typeof ChatEventSchema>;

/** What /api/advisory answers: the advisory and the engine's shared-air figure. */
export const AdvisoryReplySchema = z.object({
  advisory: AdvisorySchema,
  collective: z.nullable(CollectiveSchema),
  model: z.string(),
  recorded: z.boolean(),
});

export type AdvisoryReply = z.infer<typeof AdvisoryReplySchema>;
