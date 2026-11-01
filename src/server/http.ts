import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MAX_BODY_BYTES = 1_048_576;

async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Send an application/json request.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "Project is too large. Maximum request size is 1 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

/** Validate both sides of the contract and never expose provider errors or credentials. */
export function jsonRoute<I, O>(input: z.ZodType<I>, output: z.ZodType<O>, run: (data: I, signal: AbortSignal) => Promise<O>) {
  return async (request: Request) => {
    try {
      const parsed = input.safeParse(await readJson(request));
      if (!parsed.success) throw new ApiError(400, "Invalid request. Check the URL, project, or instruction.");
      const result = await run(parsed.data, AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]));
      const validated = output.safeParse(result);
      if (!validated.success) throw new ApiError(502, "The provider returned an invalid result. Please try again.");
      return Response.json(validated.data, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      const status = error instanceof ApiError ? error.status : timeout ? 504 : 502;
      const message = error instanceof ApiError ? error.message : timeout ? "The request timed out. Please try again." : "The generation provider could not complete this request. Please try again.";
      return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
    }
  };
}
