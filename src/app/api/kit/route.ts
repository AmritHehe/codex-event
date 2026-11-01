import { kitRequest, kitResponse } from "@/lib/contracts";
import { generateKit } from "@/server/kit";
import { jsonRoute } from "@/server/http";
import { providers } from "@/server/providers";
import { charge, workspaceFrom } from "@/server/workspace/http";
import { workspaces } from "@/server/workspace/store";

export const maxDuration = 120;
// 1 credit per channel, billed to the cookie's workspace (if any) only when the kit succeeds.
export const POST = (request: Request) =>
  jsonRoute(kitRequest, kitResponse, async (input, signal) => {
    const id = await workspaceFrom(request);
    const briefUrl = id ? (await workspaces().get(id))?.brief?.url : undefined;
    return charge(request, new Set(input.channels).size, () => generateKit(input, signal, providers, briefUrl));
  })(request);
