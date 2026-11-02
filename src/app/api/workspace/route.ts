import { limit, sameOrigin } from "@/server/limits";
import { ApiError } from "@/server/http";
import { createWorkspaceResponse } from "@/lib/agent-contracts";
import { json, sessionCookie, withWorkspace, workspaceFrom } from "@/server/workspace/http";
import { workspaces } from "@/server/workspace/store";

/** Create an anonymous workspace and return its token once. With a valid cookie, keep the workspace and issue a fresh token. */
export async function POST(request: Request) {
 try {
  sameOrigin(request);
  await limit("workspace:creation", Number(process.env.WORKSPACE_DAILY_LIMIT ?? 100));
  const store = workspaces();
  const existing = await workspaceFrom(request);
  const workspace = existing && (await store.get(existing));
  const created = workspace ? { workspace, token: await store.rotateToken(workspace.id) } : await store.create();
  return json(createWorkspaceResponse.parse(created), workspace ? 200 : 201, { "Set-Cookie": sessionCookie(created.token) });
 } catch (error) { if (error instanceof ApiError) return json({error:error.message},error.status); throw error; }
}

export const GET = withWorkspace(async (id) => {
  const workspace = await workspaces().get(id);
  return workspace ? json(workspace) : json({ error: "Workspace not found." }, 404);
});
