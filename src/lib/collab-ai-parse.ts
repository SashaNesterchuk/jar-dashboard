import { z } from "zod";

const collabAiPayloadSchema = z.object({
  chat_reply: z.string(),
  patches: z
    .array(
      z.object({
        target_chunk_index: z.number().int().nonnegative(),
        new_text: z.string(),
      })
    )
    .min(1),
});

export type CollabAiPayload = z.infer<typeof collabAiPayloadSchema>;

/** Strip optional ```json fences and parse. */
export function parseCollabAiJson(raw: string): CollabAiPayload {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) {
    t = fence[1].trim();
  }
  const parsed: unknown = JSON.parse(t);
  return collabAiPayloadSchema.parse(parsed);
}
