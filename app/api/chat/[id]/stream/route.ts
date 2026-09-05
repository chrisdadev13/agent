import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const startIndex = Number(new URL(request.url).searchParams.get("startIndex") ?? 0);
  if (!Number.isSafeInteger(startIndex) || startIndex < 0) {
    return new Response("Invalid stream position.", { status: 400 });
  }

  const run = getRun(id);
  const status = await run.status.catch(() => null);
  if (!status) return new Response("Run not found.", { status: 404 });
  if (status === "failed" || status === "cancelled") {
    return new Response("The agent run did not complete. Please retry your message.", { status: 409 });
  }

  return createUIMessageStreamResponse({ stream: run.getReadable({ startIndex }) });
}
