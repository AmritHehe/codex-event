import type { LibraryResponse } from "@/lib/library-contracts";
import { json, withWorkspace } from "@/server/workspace/http";
import { WorkspaceError, workspaces } from "@/server/workspace/store";

/** Dashboard data for the cookie's workspace: credits, connected agents, and projects (newest first). */
export const GET = withWorkspace(async (id) => {
  const store = workspaces();
  const [ws, projects] = await Promise.all([store.get(id), store.listProjects(id)]);
  if (!ws) throw new WorkspaceError(404, "Workspace not found.");
  const body: LibraryResponse = {
    credits: ws.credits,
    connections: ws.connections,
    projects: [...projects]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        updatedAt: p.updatedAt,
        scenes: p.scenes.length,
        ...(p.url ? { url: p.url } : {}),
        drafts: p.drafts.map(({ channelId, text, hashtags }) => ({ channelId, text, ...(hashtags ? { hashtags } : {}) })),
        assets: p.assets.map((a) => ({ id: a.id, kind: a.kind, ...(a.caption ? { caption: a.caption } : {}), url: a.url ?? `/api/workspace/assets/${a.id}` })),
      })),
  };
  return json(body);
});
