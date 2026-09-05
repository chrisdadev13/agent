import { createHmac, timingSafeEqual } from "node:crypto";
import { resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/internal/errors";
import { z } from "zod";
import { env } from "#/lib/env";
import type { RefundDecision } from "#/lib/refund";

const interactionSchema = z.object({
  type: z.literal("block_actions"),
  user: z.object({ id: z.string().min(1) }),
  channel: z.object({ id: z.string().min(1) }),
  actions: z
    .array(
      z.object({
        action_id: z.enum(["refund_approve", "refund_reject"]),
        value: z.string().startsWith("refund:").max(2000),
      }),
    )
    .length(1),
});

export async function POST(request: Request) {
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  const hasValidTimestamp = /^\d+$/.test(timestamp);
  const timestampDifferenceSeconds = Math.abs(
    Date.now() / 1000 - Number(timestamp),
  );
  const isOutsideFiveMinuteWindow = timestampDifferenceSeconds > 5 * 60;

  if (!hasValidTimestamp || isOutsideFiveMinuteWindow) {
    return new Response("Expired Slack request.", { status: 401 });
  }

  const signaturePayload = `v0:${timestamp}:${body}`;
  const digest = createHmac("sha256", env.SLACK_SIGNING_SECRET)
    .update(signaturePayload)
    .digest("hex");
  const expectedSignature = `v0=${digest}`;
  const hasValidSignatureFormat = /^v0=[a-f0-9]{64}$/.test(signature);

  const isValidSignature =
    hasValidSignatureFormat &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!isValidSignature) {
    return new Response("Invalid Slack signature.", { status: 401 });
  }

  const payload = new URLSearchParams(body).get("payload");
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload ?? "null");
  } catch {
    return new Response("Invalid Slack payload.", { status: 400 });
  }
  const result = interactionSchema.safeParse(parsed);
  if (!result.success)
    return new Response("Invalid Slack interaction.", { status: 400 });
  if (result.data.channel.id !== env.SLACK_CHANNEL_ID) {
    return new Response("Unexpected approval channel.", { status: 403 });
  }

  const {
    actions: [action],
    user,
  } = result.data;
  try {
    await resumeHook<RefundDecision>(action.value, {
      approved: action.action_id === "refund_approve",
      reviewer: user.id,
    });
  } catch (error) {
    if (!HookNotFoundError.is(error)) {
      console.error("Unable to resume refund approval", error);
      return new Response("Unable to record approval. Please retry.", {
        status: 500,
      });
    }
    // Acknowledge repeated clicks after the hook has been disposed.
  }
  return new Response(null, { status: 200 });
}
