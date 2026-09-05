import { createHook, FatalError, getWorkflowMetadata, RetryableError } from "workflow";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { env } from "#/lib/env";
import { formatRefund, formatRefundContext, refundInputSchema, type RefundDecision, type RefundInput } from "#/lib/refund";

async function slackMessage(method: "chat.postMessage" | "chat.update", body: Record<string, unknown>) {
  "use step";

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, channel: env.SLACK_CHANNEL_ID }),
  });
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after")) || 30;
    throw new RetryableError("Slack rate limit", { retryAfter: new Date(Date.now() + seconds * 1000) });
  }
  if (response.status >= 500) throw new Error("Slack is temporarily unavailable.");
  if (!response.ok) throw new FatalError(`Slack returned HTTP ${response.status}.`);

  const result = await response.json();
  if (!result.ok) {
    if (["internal_error", "fatal_error", "ratelimited"].includes(result.error)) {
      throw new Error(`Slack: ${result.error}`);
    }
    throw new FatalError(`Slack: ${result.error || "Unable to send message"}`);
  }
  return z.object({ channel: z.string(), ts: z.string() }).parse(result);
}

async function requestRefund(input: RefundInput, { toolCallId, messages }: { toolCallId: string; messages: ModelMessage[] }) {
  // Hooks run in the workflow; only Slack I/O runs in steps.
  const { workflowRunId } = getWorkflowMetadata();
  using approval = createHook<RefundDecision>({ token: `refund:${workflowRunId}:${toolCallId}` });
  await approval.getConflict(); // Register before Slack can deliver a button click.

  const summary = `Demo refund request: ${formatRefund(input.amountCents)}\n${input.reason}`;
  const details = [
    { type: "header", text: { type: "plain_text", text: "Refund review" } },
    { type: "section", fields: [
      { type: "plain_text", text: `Requested amount\n${formatRefund(input.amountCents)} USD` },
      { type: "plain_text", text: "Source\nRefund Agent · Web chat" },
    ] },
    { type: "section", text: { type: "plain_text", text: `Reason\n${input.reason}` } },
    { type: "divider" },
    { type: "section", text: { type: "plain_text", text: `Recent customer messages (up to 4, shortened if needed)\n${formatRefundContext(messages)}` } },
    { type: "context", elements: [
      { type: "plain_text", text: `Requested: ${new Date().toISOString()} · Workflow: ${workflowRunId}` },
    ] },
    { type: "context", elements: [{ type: "plain_text", text: "Demo only — approving records a decision; no money is moved." }] },
  ];
  // ponytail: an ambiguous network failure can duplicate the Slack post; all copies share one hook.
  // Add provider-side deduplication if exactly-once notifications become necessary.
  const message = await slackMessage("chat.postMessage", {
    text: summary,
    blocks: [
      ...details,
      { type: "section", text: { type: "plain_text", text: "Pending review · Approve or reject this refund request below." } },
      {
        type: "actions",
        elements: [
          { type: "button", action_id: "refund_approve", text: { type: "plain_text", text: "Approve" }, style: "primary", value: approval.token },
          { type: "button", action_id: "refund_reject", text: { type: "plain_text", text: "Reject" }, style: "danger", value: approval.token },
        ],
      },
    ],
  });

  const decision = await approval;
  approval.dispose(); // First decision wins; later clicks cannot change it.
  await slackMessage("chat.update", {
    ts: message.ts,
    text: `${summary}\n${decision.approved ? "Approved" : "Rejected"} by ${decision.reviewer}. Demo only — no money moved.`,
    blocks: [
      ...details,
      { type: "section", text: { type: "plain_text", text: `${decision.approved ? "Approved" : "Rejected"} by ${decision.reviewer}\nDecision recorded: ${new Date().toISOString()}` } },
    ],
  }).catch((error) => {
    // A failed notification must not discard the recorded human decision.
    console.error("Unable to update the Slack approval message", error);
  });
  return decision;
}

export const refundTools = {
  requestRefund: {
    description: "Request human approval in Slack for a refund explicitly requested by the customer. Waits for approval or rejection. This demo does not move money.",
    inputSchema: refundInputSchema,
    execute: requestRefund,
  },
};
