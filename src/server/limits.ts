import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { ApiError } from "./http";

/** Persistent, atomic daily attempt budgets. Failed provider calls still count toward the safety cap. */
export async function limit(scope: string, maximum: number) {
  if (!Number.isSafeInteger(maximum) || maximum < 1)
    throw new ApiError(503, "Invalid server usage limit.");
  const dir = resolve(
    /*turbopackIgnore: true*/ process.env.LIMIT_DATA_DIR ?? ".data/limits",
  );
  await mkdir(dir, { recursive: true });
  const name = createHash("sha256")
    .update(`${new Date().toISOString().slice(0, 10)}:${scope}`)
    .digest("hex");
  const file = join(dir, name);
  const lock = `${file}.lock`;
  let acquired = false;
  for (let i = 0; i < 100; i++) {
    try {
      await mkdir(lock);
      acquired = true;
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  if (!acquired)
    throw new ApiError(503, "Usage budget is busy. Try again shortly.");
  try {
    let count = 0;
    try {
      count = Number(await readFile(file, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (!Number.isSafeInteger(count) || count < 0)
      throw new ApiError(503, "Usage budget is unavailable.");
    if (count >= maximum)
      throw new ApiError(429, "Daily usage limit reached. Try again tomorrow.");
    await writeFile(`${file}.tmp`, String(count + 1), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
export async function paidAttempt(workspaceId: string) {
  await limit(
    `paid:workspace:${workspaceId}`,
    Number(process.env.AI_WORKSPACE_DAILY_LIMIT ?? 30),
  );
  await limit("paid:global", Number(process.env.AI_GLOBAL_DAILY_LIMIT ?? 100));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // non-browser API clients authenticate separately
  const configured = process.env.APP_ORIGIN;
  const target = new URL(request.url);
  const source = new URL(origin === "null" ? "https://invalid.invalid" : origin);
  const host = request.headers.get("host") ?? target.host;
  if (configured ? source.origin !== new URL(configured).origin : source.host !== host || !["http:","https:"].includes(source.protocol))
    throw new ApiError(403, "Use this site's own page to perform this action.");
}
