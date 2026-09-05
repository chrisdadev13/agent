import { convertToModelMessages, createUIMessageStreamResponse } from "ai";
import { start } from "workflow/api";
import { z } from "zod";
import { chatWorkflow } from "#/workflows/chat";
import { refundInputSchema, refundDecisionSchema } from "#/lib/refund";

const refundPartSchema = z.object({
  type: z.literal("tool-requestRefund"),
  toolCallId: z.string(),
  input: refundInputSchema,
}).and(z.discriminatedUnion("state", [
  z.object({ state: z.literal("output-available"), output: refundDecisionSchema }),
  z.object({ state: z.literal("output-error"), errorText: z.string() }),
]));

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.union([
    z.object({ type: z.literal("text"), text: z.string().max(10000) }),
    z.object({ type: z.literal("step-start") }),
    refundPartSchema,
  ])).refine(
    (parts) => parts.some((part) => part.type === "tool-requestRefund" || (part.type === "text" && part.text.trim())),
    "Each message must contain text or a refund result.",
  ),
}).refine(
  (message) => message.role === "assistant" || message.parts.every((part) => part.type !== "tool-requestRefund"),
  "Only assistant messages can contain refund results.",
);

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(100).refine(
    (messages) => messages.at(-1)?.role === "user",
    "The last message must be from the user.",
  ),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = chatRequestSchema.safeParse(body);

  if (!result.success) {
    return new Response(result.error.issues[0].message, { status: 400 });
  }

  try {
    const messages = await convertToModelMessages(result.data.messages);
    const run = await start(chatWorkflow, [messages]);
    return createUIMessageStreamResponse({
      stream: run.readable,
      headers: { "x-workflow-run-id": run.runId },
    });
  } catch (error) {
    console.error("Unable to start chat workflow", error);
    return new Response("Unable to start the agent. Please try again.", { status: 500 });
  }
}
