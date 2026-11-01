import { researchBrief, researchRequest } from "@/lib/research-contracts";
import { jsonRoute } from "@/server/http";
import { research } from "@/server/research";
import { charge } from "@/server/workspace/http";

export const maxDuration = 120;
// 1 credit, billed to the cookie's workspace (if any) only when research succeeds. Cached URLs answer instantly.
export const POST = (request: Request) =>
  jsonRoute(researchRequest, researchBrief, ({ url }, signal) => charge(request, 1, () => research(url, signal)))(request);
