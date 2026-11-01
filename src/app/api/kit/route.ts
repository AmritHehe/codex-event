import { kitRequest, kitResponse } from "@/lib/contracts";
import { generateKit } from "@/server/kit";
import { jsonRoute } from "@/server/http";
import { charge } from "@/server/workspace/http";

export const maxDuration = 120;
// 1 credit per channel, billed to the cookie's workspace (if any) only when the kit succeeds.
export const POST = (request: Request) =>
  jsonRoute(kitRequest, kitResponse, (input, signal) => charge(request, new Set(input.channels).size, () => generateKit(input, signal)))(request);
