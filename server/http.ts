import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { renderRequest } from "../src/lib/contracts";
import { projectDuration } from "../src/video/schema";
import { RenderQueue } from "./queue";

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

function readJson(req: IncomingMessage): Promise<unknown> {
  if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Send application/json.");
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let exceeded = false;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1_048_576) {
        if (!exceeded) { exceeded = true; reject(new HttpError(413, "Maximum request size is 1 MB.")); }
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (exceeded) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new HttpError(400, "Request body must be valid JSON.")); }
    });
    req.on("error", reject);
    req.on("aborted", () => reject(new HttpError(400, "Request was interrupted.")));
  });
}

const json = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};

export function createRenderServer(queue: RenderQueue, outDir: string, origins = ["http://localhost:3000", "http://127.0.0.1:3000"]) {
  return createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      res.setHeader("Vary", "Origin");
      if (origin && !origins.includes(origin)) throw new HttpError(403, "This origin is not allowed.");
      if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (path === "/render" && req.method === "POST") {
        const parsed = renderRequest.safeParse(await readJson(req));
        if (!parsed.success) throw new HttpError(400, "Invalid video project.");
        const { project } = parsed.data;
        if (projectDuration(project) > 18_000 || project.scenes.length > 50 || project.scenes.some((s) => s.layers.length > 100)) throw new HttpError(413, "Project exceeds the demo render limits.");
        try { json(res, 202, queue.enqueue(project)); }
        catch (e) { throw new HttpError(503, e instanceof Error ? e.message : "Render queue is unavailable."); }
        return;
      }
      const status = path.match(new RegExp(`^/render/(${uuid})$`));
      if (status && req.method === "GET") {
        const job = queue.get(status[1]);
        if (!job) throw new HttpError(404, "Render job not found. Jobs reset when the server restarts.");
        json(res, 200, job);
        return;
      }
      const file = path.match(new RegExp(`^/files/(${uuid})\\.mp4$`));
      if (file && ["GET", "HEAD"].includes(req.method ?? "")) {
        if (queue.get(file[1])?.status !== "done") throw new HttpError(404, "Rendered video is not ready.");
        const filename = `${file[1]}.mp4`;
        const location = join(outDir, filename);
        const info = await stat(location).catch(() => null);
        if (!info?.isFile()) throw new HttpError(404, "Rendered video was not found.");
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": info.size, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
        if (req.method === "HEAD") res.end();
        else {
          const stream = createReadStream(location);
          stream.on("error", () => res.destroy());
          res.on("close", () => stream.destroy());
          stream.pipe(res);
        }
        return;
      }
      throw new HttpError(404, "Route not found.");
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      json(res, error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : "Render server request failed." });
    }
  });
}
