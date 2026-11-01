import { paidAttempt, sameOrigin } from "../limits";
import { ApiError } from "@/server/http";
import { WorkspaceError, workspaces } from "./store";

export const COOKIE = "shipcast_ws";
const YEAR = 60 * 60 * 24 * 365;

export const sessionCookie = (token: string) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${YEAR}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

const cookieToken = (request: Request) =>
  request.headers.get("cookie")?.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);

/** Workspace id from the httpOnly cookie, or null for anonymous requests (and stale or forged cookies). */
export async function workspaceFrom(request: Request) {
  const token = cookieToken(request);
  return token ? workspaces().findByToken(token) : null;
}

const noStore = { "Cache-Control": "no-store" };
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { ...noStore, ...headers } });

export const unauthorized = () => json({ error: "No Shipcast workspace. Create one with POST /api/workspace (the /connect page does this)." }, 401);

/** Cookie-authenticated GET handler with WorkspaceError -> HTTP mapping. */
export function withWorkspace<C>(run: (workspaceId: string, request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C) => {
    try {
      if (!["GET","HEAD","OPTIONS"].includes(request.method)) sameOrigin(request);
      const id = await workspaceFrom(request);
      return id ? await run(id, request, context) : unauthorized();
    } catch (error) {
      if (error instanceof WorkspaceError || error instanceof ApiError) return json({ error: error.message }, error.status);
      throw error;
    }
  };
}

/**
 * Bill server-paid AI to the caller's workspace. A valid workspace is required. The cost is reserved
 * up front (so concurrent calls cannot overdraw) and refunded if the work fails: net, only success is billed.
 */
export async function charge<T>(request: Request, cost: number, run: () => Promise<T>): Promise<T> {
  const id = await workspaceFrom(request);
  sameOrigin(request);
  if (!id) {
    if (process.env.NODE_ENV !== "production" && process.env.ALLOW_ANONYMOUS_AI === "true") return run();
    throw new ApiError(401, "Create a workspace before using AI.");
  }
  await paidAttempt(id);
  const store = workspaces();
  let remaining: number;
  try { remaining = await store.spendCredits(id, cost); }
  catch (error) { throw error instanceof WorkspaceError ? new ApiError(error.status, error.message) : error; }
  try {
    const result = await run();
    store.publish(id, { type: "credits", remaining });
    return result;
  } catch (error) {
    await store.addCredits(id, cost);
    throw error;
  }
}
