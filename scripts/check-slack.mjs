import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// Manual callback checks only: no OpenAI calls, Slack posts, or live hook tokens.
const secret = process.env.SLACK_SIGNING_SECRET;
assert.ok(secret, "Load .env.local with --env-file=.env.local");
const url = `${process.env.CHAT_BASE_URL || "http://localhost:3000"}/api/slack`;
const body = new URLSearchParams({ payload: JSON.stringify({
  type: "block_actions",
  user: { id: "U_CHECK" },
  channel: { id: "C_WRONG_CHANNEL" },
  actions: [{ action_id: "refund_approve", value: "refund:nonexistent-check" }],
}) }).toString();

async function post(rawBody, { timestamp = String(Math.floor(Date.now() / 1000)), signature } = {}) {
  const signed = signature ?? `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signed,
    },
    body: rawBody,
  });
}

assert.equal((await post(body, { signature: "v0=invalid" })).status, 401);
assert.equal((await post(body, { signature: `v0=${"0".repeat(64)}` })).status, 401);
assert.equal((await post(body, { timestamp: String(Math.floor(Date.now() / 1000) - 301) })).status, 401);
assert.equal((await post("payload=%7B")).status, 400, "Malformed JSON must be rejected");
assert.equal((await post("payload=%7B%7D")).status, 400, "Malformed interactions must be rejected");
assert.equal((await post(body)).status, 403, "A valid signature must not bypass channel validation");
console.log("Slack signature, timestamp, payload, and channel checks passed.");
