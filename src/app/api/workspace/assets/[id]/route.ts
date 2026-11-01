import { json, withWorkspace } from "@/server/workspace/http";
import { workspaces } from "@/server/workspace/store";

const notFound = () => json({ error: "Asset not found." }, 404);

/** Stored image bytes, only for assets owned by the cookie's workspace. Remote (https) assets are not proxied. */
export const GET = withWorkspace<{ params: Promise<{ id: string }> }>(async (workspaceId, _request, { params }) => {
  const { id } = await params;
  if (!/^a_[a-f0-9]{16}$/.test(id)) return notFound();
  const asset = await workspaces().readAsset(workspaceId, id);
  if (!asset || !("bytes" in asset) || (asset.type !== "image/png" && asset.type !== "image/jpeg")) return notFound();
  return new Response(new Uint8Array(asset.bytes), {
    headers: { "Content-Type": asset.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});
