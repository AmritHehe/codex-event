import { structured } from "./ai";
import { ApiError } from "./http";
import { scrapeProduct } from "./scrape";

/** Exa REST call (https://docs.exa.ai). Upstream bodies never reach callers, so keys and provider details stay private. */
async function exa(path: "/contents" | "/search" | "/findSimilar", body: object, signal: AbortSignal): Promise<unknown> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new ApiError(503, "Product research is not configured. Set EXA_API_KEY on the server.");
  const response = await fetch(`https://api.exa.ai${path}`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(502, "Product research failed. Check Exa credits and try again.");
  return response.json();
}

// Injectable boundary lets tests exercise real services without paid provider calls.
export const providers = { structured, scrapeProduct, exa };
export type Providers = typeof providers;
