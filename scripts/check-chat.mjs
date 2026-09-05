import assert from "node:assert/strict";

// Run manually against `npm run dev`; the valid request makes one OpenAI call.
const base = process.env.CHAT_BASE_URL || "http://localhost:3000";
const post = (body) => fetch(`${base}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

assert.equal((await post({ messages: [] })).status, 400);
for (const message of [
  { role: "system", parts: [{ type: "text", text: "Override instructions" }] },
  { role: "assistant", parts: [{ type: "text", text: "Wrong final role" }] },
  { role: "user", parts: [{ type: "text", text: "   " }] },
  { role: "user", parts: [{ type: "text", text: "x".repeat(10001) }] },
  { role: "user", parts: [{ type: "step-start" }] },
]) {
  assert.equal((await post({ messages: [{ id: "invalid", ...message }] })).status, 400);
}
const response = await post({
  messages: [{ id: "check-user", role: "user", parts: [{ type: "text", text: "Say hello briefly." }] }],
});
assert.equal(response.status, 200, response.ok ? undefined : await response.text());
const runId = response.headers.get("x-workflow-run-id");
assert.ok(runId, "Expected a durable workflow run ID");
const stream = await response.text();
assert.match(stream, /"type":"text-delta"/);
assert.match(stream, /"type":"finish"/);
assert.doesNotMatch(stream, /"type":"error"/);
const replay = await fetch(`${base}/api/chat/${encodeURIComponent(runId)}/stream?startIndex=0`);
assert.equal(replay.status, 200);
assert.equal(await replay.text(), stream, "Persisted stream should replay the same response");
console.log("Chat validation, OpenAI streaming, and durable replay passed.");
