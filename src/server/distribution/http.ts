import { createHash, timingSafeEqual } from "node:crypto";

export class DistributionError extends Error { constructor(public status: number, message: string) { super(message); } }
export function authenticate(request: Request) {
  const key = process.env.DISTRIBUTION_TOKEN;
  if (!key || key.length < 24) throw new DistributionError(503, "Publishing is not configured. Set a server publishing key of at least 24 characters.");
  const header = request.headers.get("authorization") ?? "";
  const digest = (text: string) => createHash("sha256").update(text).digest();
  if (!timingSafeEqual(digest(header), digest(`Bearer ${key}`))) throw new DistributionError(401, "Enter the workspace publishing key.");
}
export async function readBody(request: Request, maximum = 65_536) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new DistributionError(415, "Send application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new DistributionError(400, "Request body is required.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) { await reader.cancel(); throw new DistributionError(413, "Draft is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new DistributionError(400, "Request body must be valid JSON."); }
}
export const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function failure(error: unknown) {
  return reply({ error: error instanceof DistributionError ? error.message : "The provider request failed. Please try again." }, error instanceof DistributionError ? error.status : 502);
}
