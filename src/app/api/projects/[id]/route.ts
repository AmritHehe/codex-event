import { projectResponse } from "@/lib/agent-contracts";
import { json, withWorkspace } from "@/server/workspace/http";
import { toProject, workspaces } from "@/server/workspace/store";

/** The project the user's agent is building. Only readable by its own workspace (404 otherwise). */
export const GET = withWorkspace(async (workspaceId, _request, context: RouteContext<"/api/projects/[id]">) => {
  const project = await workspaces().getProject(workspaceId, (await context.params).id);
  if (!project) return json({ error: "Project not found." }, 404);
  return json(projectResponse.parse({ project: toProject(project), status: project.status }));
});
