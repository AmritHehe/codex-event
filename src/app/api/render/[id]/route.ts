import { json, withWorkspace } from "@/server/workspace/http";
import { ApiError } from "@/server/http";
import { ownedRender, renderFetch } from "@/server/render-client";
import { renderJob } from "@/lib/contracts";
export const GET = withWorkspace(
  async (
    workspaceId,
    _request,
    context: { params: Promise<{ id: string }> },
  ) => {
    try {
      const { id } = await context.params;
      await ownedRender(workspaceId, id);
      const response = await renderFetch(`/render/${id}`, workspaceId);
      if (!response.ok)
        return json(
          { error: "Render not found or service unavailable." },
          response.status === 404 ? 404 : 502,
        );
      const job = renderJob.parse(await response.json());
      return json({
        ...job,
        url: job.url?.startsWith("https://")
          ? job.url
          : job.url
            ? `/api/render/${id}/file`
            : undefined,
      });
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, e.status);
      return json({ error: "Render service unavailable." }, 502);
    }
  },
);
