import { briefRequest, workspace } from "@/lib/agent-contracts";
import { ApiError, jsonRoute } from "@/server/http";
import { workspaceFrom } from "@/server/workspace/http";
import { WorkspaceError, workspaces } from "@/server/workspace/store";

/** Save the product URL the user's agent should build next (read by the MCP tool get_brief). */
export const POST = (request: Request) =>
  jsonRoute(briefRequest, workspace, async (input) => {
    const id = await workspaceFrom(request);
    if (!id) throw new ApiError(401, "No Shipcast workspace. Create one with POST /api/workspace first.");
    try { return await workspaces().setBrief(id, input); }
    catch (error) { throw error instanceof WorkspaceError ? new ApiError(error.status, error.message) : error; }
  })(request);
