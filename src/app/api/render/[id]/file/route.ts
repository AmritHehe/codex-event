import { json, withWorkspace } from "@/server/workspace/http";
import { ApiError } from "@/server/http";
import { ownedRender, renderFetch } from "@/server/render-client";
export const GET = withWorkspace(
  async (
    workspaceId,
    _request,
    context: { params: Promise<{ id: string }> },
  ) => {
    try {
      const { id } = await context.params;
      await ownedRender(workspaceId, id);
      const response = await renderFetch(`/files/${id}.mp4`, workspaceId);
      if (!response.ok) return json({ error: "Video is not ready." }, 404);
      return new Response(response.body, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${id}.mp4"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (e) {
      return json(
        { error: e instanceof ApiError ? e.message : "Render unavailable." },
        e instanceof ApiError ? e.status : 502,
      );
    }
  },
);
