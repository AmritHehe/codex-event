import { generateRequest, generateResponse } from "@/lib/contracts";
import { generate } from "@/server/generation";
import { jsonRoute } from "@/server/http";
import { charge, workspaceFrom } from "@/server/workspace/http";

export const maxDuration = 120;
// 2 credits, billed to the cookie's workspace (if any) only when generation succeeds.
export const POST = (request: Request) =>
  jsonRoute(generateRequest, generateResponse, ({ url }, signal) => charge(request, 2, async () => generate(url, signal, undefined, (await workspaceFrom(request)) ?? "anonymous")))(request);
