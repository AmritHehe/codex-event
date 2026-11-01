import { createWorkspaceResponse } from "@/lib/agent-contracts";
import { json, sessionCookie, withWorkspace, workspaceFrom } from "@/server/workspace/http";
import { workspaces } from "@/server/workspace/store";

/** Create an anonymous workspace and return its token once. With a valid cookie, keep the workspace and issue a fresh token. */
export async function POST(request: Request) {
  const store = workspaces();
  const existing = await workspaceFrom(request);
  const workspace = existing && (await store.get(existing));
  const created = workspace ? { workspace, token: await store.rotateToken(workspace.id) } : await store.create();
  return json(createWorkspaceResponse.parse(created), workspace ? 200 : 201, { "Set-Cookie": sessionCookie(created.token) });
}

export const GET = withWorkspace(async (id) => {
  const workspace = await workspaces().get(id);
  return workspace ? json(workspace) : json({ error: "Workspace not found." }, 404);
});
