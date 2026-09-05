import type { ModelMessage, UIMessage } from "ai";
import { z } from "zod";

export const refundInputSchema = z.object({
  amountCents: z
    .number()
    .int()
    .positive()
    .max(100000000)
    .describe("Refund amount in US cents; $1,200 is 120000."),
  reason: z.string().trim().min(1).max(500),
});

export const refundDecisionSchema = z.object({
  approved: z.boolean(),
  reviewer: z.string().min(1),
});

export type RefundInput = z.infer<typeof refundInputSchema>;
export type RefundDecision = z.infer<typeof refundDecisionSchema>;
export type RefundChatMessage = UIMessage<
  unknown,
  Record<string, never>,
  {
    requestRefund: { input: RefundInput; output: RefundDecision };
  }
>;

export function formatRefund(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

export function formatRefundContext(messages: ModelMessage[]) {
  return (
    messages
      .filter((message) => message.role === "user")
      .slice(-4)
      .map((message) => {
        const text =
          typeof message.content === "string"
            ? message.content
            : message.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n");
        return `• ${text.length > 600 ? `${text.slice(0, 600)}…` : text}`;
      })
      .join("\n\n") || "No customer messages available."
  );
}
