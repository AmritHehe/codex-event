import { json, withWorkspace } from "@/server/workspace/http";
import { workspaces } from "@/server/workspace/store";

export const maxDuration = 300;
const HEARTBEAT_MS = 15_000;

/**
 * Server-Sent Events: one JSON `agentEvent` per `data:` line, heartbeat comments, cleanup on disconnect.
 * Events come from MCP tool calls handled by the same server process (see the bus note in the store).
 */
export const GET = withWorkspace(async (id, request) => {
  if (!(await workspaces().get(id))) return json({ error: "Workspace not found." }, 404);
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try { controller.enqueue(encoder.encode(chunk)); } catch { cleanup(); }
      };
      const unsubscribe = workspaces().subscribe(id, (event) => send(`data: ${JSON.stringify(event)}\n\n`));
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", cleanup);
        try { controller.close(); } catch { /* already closed */ }
      };
      request.signal.addEventListener("abort", cleanup);
      send(": connected\n\n");
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
});
