import assert from "node:assert/strict";
import { formatRefundContext } from "../lib/refund.ts";

const messages = [
  { role: "user", content: "Older message" },
  { role: "assistant", content: "Do not present this as a customer statement" },
  ...["Billing issue", "Two charges", "One subscription"].map((content) => ({ role: "user", content })),
  { role: "user", content: [{ type: "text", text: "Refund please " + "x".repeat(1000) }] },
];
const context = formatRefundContext(messages);
assert.ok(context.startsWith("• Billing issue"));
assert.ok(!context.includes("Older message") && !context.includes("Do not present"));
assert.ok(context.includes("Refund please") && context.endsWith("…"));
assert.ok(formatRefundContext(Array(4).fill(messages.at(-1))).length < 2900);
assert.equal(formatRefundContext([]), "No customer messages available.");
console.log("Refund context selection and Slack length limits passed.");
