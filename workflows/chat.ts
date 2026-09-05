import { DurableAgent } from "@workflow/ai/agent";
import { openai } from "@workflow/ai/openai";
import type { ModelMessage, UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import { refundTools } from "#/workflows/refund";

export async function chatWorkflow(messages: ModelMessage[]) {
  "use workflow";

  const agent = new DurableAgent({
    model: openai("gpt-4.1-mini"),
    instructions:
      "You are a helpful refund support assistant. Give concise, clear answers " +
      "and ask for missing details. When the customer explicitly asks for a refund " +
      "and has provided the amount and reason, call requestRefund exactly once. " +
      "Do not request approval for a billing question alone. All refunds need human approval. " +
      "After the tool returns, explain whether the reviewer approved or rejected it. " +
      "This is a demo: you cannot access accounts or transfer money. Never claim a refund was issued.",
    tools: refundTools,
    maxOutputTokens: 2048,
  });

  const result = await agent.stream({
    messages,
    writable: getWritable<UIMessageChunk>(),
    maxSteps: 2,
  });

  return result.messages;
}
