Refund Agent
============

A refund support demo built with Next.js, Workflow SDK, and OpenAI.
Chat about a billing issue, then approve or reject the refund request in Slack.
Every refund requires a human decision. This demo does not move money.

Quick Start
-----------

```sh
npm i
cp .env.example .env.local
```

Fill in all four credentials in `.env.local`, then run `npm run dev`.
Open http://localhost:3000.

Slack Setup
-----------

* Set `SLACK_CHANNEL_ID`, `SLACK_BOT_TOKEN`, and `SLACK_SIGNING_SECRET`.
* Set `OPENAI_API_KEY` for the chat agent.
* Install your Slack app with the `chat:write` bot scope and invite it to the channel.
* Enable Interactivity with your public HTTPS app URL followed by `/api/slack`.
  Local development needs an HTTPS tunnel to port 3000.

Event subscriptions are not required. Anyone who can click the approval buttons
in the configured channel can review a request. The first decision wins.

Try It
------

Follow the suggested chat prompts to request a refund for the duplicate $1,200
charge. Approve or reject the request in Slack, then return to the chat for the
result. You can also type your own messages.

Conversation history resets on reload. An ambiguous network failure while
posting to Slack can produce a duplicate notification.

Source Guide
------------

* Chat interface: [app/page.tsx](app/page.tsx)
* Agent instructions and model: [workflows/chat.ts](workflows/chat.ts)
* Refund approval workflow: [workflows/refund.ts](workflows/refund.ts)
* Slack interactions: [app/api/slack/route.ts](app/api/slack/route.ts)
* Environment variables: [.env.example](.env.example)
* AI contributor instructions: [AGENTS.md](AGENTS.md)

Development
-----------

* Production build: `npm run build`
* Type checking: `npm run typecheck`
* Lint: `npm run lint`
* Inspect workflow runs: `npx workflow inspect runs`

All four environment variables are required for startup and builds.
Git hooks run lint and type checking before commits and pushes.

To check the demo manually, try both approval and rejection, send a follow-up
message, and confirm that an old approval button cannot change the decision.
