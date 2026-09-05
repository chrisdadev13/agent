"use client";

import { useChat } from "@ai-sdk/react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "#/components/ui/input-group";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "#/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "#/components/ui/message-scroller";
import { formatRefund, type RefundChatMessage } from "#/lib/refund";

const demoMessages = [
  "Hi, I need help with a subscription charge.",
  "I see two charges of $1,200 for the same subscription this month.",
  "Both charges are completed, and I only have one subscription.",
  "Can you refund the extra $1,200?",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [demoStep, setDemoStep] = useState(0);
  const runId = useRef<string | null>(null);
  const [transport] = useState(
    () =>
      new WorkflowChatTransport<RefundChatMessage>({
        onChatSendMessage: (response) => {
          runId.current = response.headers.get("x-workflow-run-id");
        },
        prepareReconnectToStreamRequest: ({ api }) => ({
          api: runId.current
            ? `/api/chat/${encodeURIComponent(runId.current)}/stream`
            : api,
        }),
      }),
  );
  const { messages, sendMessage, status, error, regenerate, resumeStream } =
    useChat<RefundChatMessage>({ transport });
  const busy = status === "submitted" || status === "streaming";
  const awaitingApproval = messages
    .at(-1)
    ?.parts.some(
      (part) =>
        part.type === "tool-requestRefund" && part.state === "input-available",
    );

  function send(text: string) {
    if (busy || awaitingApproval || !text.trim()) return;
    void sendMessage({ text: text.trim() });
    setInput("");
  }

  return (
    <main
      aria-labelledby="agent-title"
      className="flex h-dvh flex-col overflow-hidden bg-white text-[#171717] [--font-mono:SFMono-Regular,Consolas,Liberation_Mono,monospace]"
    >
      <title>Refund Agent</title>
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#ececec] bg-[#fafafa] px-4">
        <Badge
          variant="outline"
          className="h-auto rounded-[5px] border-[#ececec] bg-white px-[7px] py-[5px] font-mono text-[9px] leading-normal font-normal text-neutral-500"
        >
          OpenAI
        </Badge>
      </header>

      <MessageScrollerProvider defaultScrollPosition="end">
        <MessageScroller className="h-auto flex-1">
          <MessageScrollerViewport
            aria-label="Conversation"
            className="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400"
          >
            <MessageScrollerContent className="mx-auto w-full max-w-[760px] gap-7 px-[22px] pt-[30px] pb-4 sm:gap-[34px] sm:px-12 sm:pt-11 sm:pb-[22px]">
              {messages.length === 0 && (
                <p className="text-sm leading-relaxed text-neutral-500">
                  Ask about a billing issue, or follow the guided demo below.
                </p>
              )}
              {messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message className="grid grid-cols-1 gap-[7px] sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-[18px]">
                    <MessageHeader className="items-start px-0 font-mono text-[9px] leading-normal font-normal tracking-[0.06em] text-neutral-400 uppercase sm:pt-1">
                      {message.role === "user" ? "Customer" : "Agent"}
                    </MessageHeader>
                    <MessageContent className="max-w-[480px] whitespace-pre-wrap text-sm leading-[1.72] tracking-[-0.01em]">
                      {message.parts.map((part, index) => {
                        if (part.type === "text")
                          // biome-ignore lint/suspicious/noArrayIndexKey: Streamed parts keep their positions and have no IDs; text changes during streaming.
                          return <p key={index}>{part.text}</p>;
                        if (part.type !== "tool-requestRefund") return null;
                        return (
                          <section
                            key={part.toolCallId}
                            aria-label="Refund approval"
                            className="my-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed"
                          >
                            <div className="flex items-center justify-between gap-4 font-semibold">
                              <span>Human approval</span>
                              <span>
                                {part.state === "output-available"
                                  ? part.output.approved
                                    ? "APPROVED"
                                    : "REJECTED"
                                  : part.state === "output-error"
                                    ? "ERROR"
                                    : "PENDING"}
                              </span>
                            </div>
                            {part.input?.amountCents != null && (
                              <p className="mt-2 text-lg font-semibold">
                                {formatRefund(part.input.amountCents)}
                              </p>
                            )}
                            {part.input?.reason && <p>{part.input.reason}</p>}
                            <p className="mt-2 text-neutral-600">
                              {part.state === "output-available"
                                ? `Decision recorded from Slack reviewer ${part.output.reviewer}. Demo only — no money moved.`
                                : part.state === "output-error"
                                  ? "Could not complete the approval request. Check the workflow logs."
                                  : "Sending the request to Slack and waiting for a reviewer to approve or reject it."}
                            </p>
                          </section>
                        );
                      })}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              {busy && (
                <output className="text-xs text-neutral-500">
                  {awaitingApproval
                    ? "Waiting for a decision in Slack…"
                    : status === "submitted"
                      ? "Agent is thinking…"
                      : "Agent is replying…"}
                </output>
              )}
              {error && (
                <div role="alert" className="text-sm text-red-700">
                  <p>
                    {error.message || "Something went wrong. Please try again."}
                  </p>
                  <button
                    type="button"
                    className="mt-2 cursor-pointer underline"
                    disabled={busy}
                    onClick={() =>
                      void (awaitingApproval ? resumeStream() : regenerate())
                    }
                  >
                    {awaitingApproval
                      ? "Reconnect to approval"
                      : "Retry last message"}
                  </button>
                </div>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="mx-auto w-full max-w-[760px] shrink-0 px-[22px] pt-3 pb-6 sm:px-12"
      >
        {demoStep < demoMessages.length && (
          <div className="mb-3 flex flex-col items-start gap-2">
            <span className="font-mono text-[9px] text-neutral-400 uppercase">
              Guided demo · {demoStep + 1} of {demoMessages.length}
            </span>
            <button
              type="button"
              disabled={busy || awaitingApproval || Boolean(error)}
              onClick={() => {
                send(demoMessages[demoStep]);
                setDemoStep(demoStep + 1);
              }}
              className="cursor-pointer rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {demoMessages[demoStep]} <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}
        <InputGroup className="items-end overflow-hidden rounded-2xl border-neutral-200 bg-neutral-50/60 shadow-[0_2px_8px_rgba(0,0,0,0.025)] transition-[background-color,border-color,box-shadow] focus-within:bg-white has-[textarea]:rounded-2xl">
          <InputGroupTextarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={10000}
            aria-label="Message to the refund agent"
            rows={1}
            placeholder="Ask the refund agent..."
            className="max-h-48 min-h-14 px-5 py-4 text-base leading-6 placeholder:text-neutral-400 md:text-sm md:leading-6"
          />
          <InputGroupAddon
            align="inline-end"
            className="self-end p-2.5 has-[>button]:mr-0"
          >
            <InputGroupButton
              type="submit"
              disabled={busy || awaitingApproval || !input.trim()}
              variant="default"
              size="icon-sm"
              aria-label="Send message"
              className="size-9 cursor-pointer rounded-full border-0 bg-neutral-900 p-0 text-white hover:bg-neutral-700 active:scale-95"
            >
              <HugeiconsIcon
                icon={ArrowUp02Icon}
                strokeWidth={2}
                className="size-[18px]"
                aria-hidden="true"
              />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      <footer className="flex h-[35px] shrink-0 items-center justify-between border-t border-[#ececec] bg-[#fafafa] px-4 font-mono text-[8px] tracking-[0.04em] text-neutral-400 uppercase">
        <span>Durable workflow</span>
        <span className="hidden sm:inline">Human approval via Slack</span>
      </footer>
    </main>
  );
}
