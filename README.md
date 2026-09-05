```text
+------------------------------------------------------+
|                                                      |
|   R E F U N D   A G E N T                             |
|   ------------------------------------------------   |
|   AI support. Durable workflows. Human approvals.    |
|                                                      |
|   > SYSTEM READY_                                    |
|                                                      |
+------------------------------------------------------+
```

A refund support demo built with Next.js, React, Workflow SDK, and
OpenAI. Chat with the agent about a billing issue, then approve or reject
its refund request in Slack. This demo does not move money.

## [01] BOOT

```bash
npm ci
cp .env.example .env.local
```

Fill in `.env.local` with your credentials, then start the app:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## [02] CONFIG

| Variable | Purpose |
| --- | --- |
| `SLACK_CHANNEL_ID` | Channel where refund approval requests are posted. |
| `SLACK_BOT_TOKEN` | Bot token used to post and update Slack messages. |
| `SLACK_SIGNING_SECRET` | Secret used to verify incoming Slack interactions. |
| `OPENAI_API_KEY` | API key used by the chat agent. |

Keep credentials in `.env.local`, which is ignored by Git.
The committed `.env.example` contains empty values only.
All four variables are required. [T3 Env](https://env.t3.gg/docs/nextjs) validates
them in `lib/env.ts` when Next.js loads its config; missing or empty values stop
startup and builds.

For Slack approvals, install your Slack app with the `chat:write` bot scope
and invite the bot to the approval channel. Enable Interactivity and set
its Request URL to your publicly reachable HTTPS app URL followed by
`/api/slack`. Local development needs an HTTPS tunnel to port 3000.

Event subscriptions are not needed for approval buttons. Anyone who can click
them in the configured channel can review the demo request. Callbacks verify
Slack's signature, timestamp, and channel; the first decision wins.

The agent uses `gpt-4.1-mini`, configured in
[`workflows/chat.ts`](workflows/chat.ts).

## [03] RUN THE DEMO

1. Follow the four suggested prompts, starting with a subscription charge.
2. Request a refund for the duplicate $1,200 charge.
3. Open the approval message in your configured Slack channel.
4. Click **Approve** or **Reject**. The workflow resumes and the agent reports the decision.

You can also type your own messages and send with Cmd/Ctrl+Enter.
Every refund request requires a human decision.

```text
CUSTOMER --> AGENT --> SLACK APPROVAL
               ^             |
               +-- DECISION -+
```

Each chat turn starts a durable workflow with the conversation history.
Interrupted streams can reconnect to the existing run. The page's conversation
history and guided demo progress reset on reload.

Successful Slack posts are persisted as workflow steps. An ambiguous network
failure while posting can produce a duplicate notification sharing the same hook.

## [04] FILE MAP

```text
app/page.tsx                    Chat interface and guided prompts
app/api/chat/route.ts           Start a chat workflow
app/api/chat/[id]/stream/       Reconnect to a persisted stream
app/api/slack/route.ts          Verify Slack interactions and resume approvals
workflows/chat.ts              Agent instructions and model
workflows/refund.ts            Slack messages and approval hook
lib/refund.ts                  Refund schemas and currency formatting
```

## [05] MANUAL CHECKS

With all four environment variables configured and the development server running,
check Slack approval and rejection manually using the guided demo.
After approving or rejecting in the demo, send a follow-up message to
check that tool results remain in the conversation history. An old approval
button must not change the recorded decision.

Implementation references: [Vercel's Slack workflow guide](https://vercel.com/kb/guide/building-a-slack-agent-with-durable-workflows)
and [Slack request verification](https://docs.slack.dev/authentication/verifying-requests-from-slack/).

Additional commands, run manually as needed:

Husky installs Git hooks during `npm ci` or `npm install`. Both pre-commit and
pre-push run `npm run lint` followed by `npm run typecheck`, blocking on failure.
Typecheck generates Next.js route types before checking TypeScript, so configure
the four environment variables in `.env.local` first. Beyond `strict`, TypeScript
also checks for missing returns, switch fallthrough, and implicit overrides.

```bash
npx workflow inspect runs
npm run build
npm run typecheck
npm run lint
```

```text
> END OF FILE. AWAITING INPUT_
```
