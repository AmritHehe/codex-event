import { workspaceFrom } from "@/server/workspace/http";
import { sameOrigin } from "@/server/limits";
import { z } from "zod";
import { authenticate, failure, readBody, reply } from "@/server/distribution/http";
import { decodeImage, putAsset } from "@/server/assets/blob";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    authenticate(request);
    sameOrigin(request);
    const input = z.object({ dataUrl: z.string().max(2_800_000) }).safeParse(await readBody(request, 2_800_000));
    if (!input.success) return reply({ error: "Provide a PNG or JPEG data URL, at most 2 MB." }, 400);
    const { bytes, type } = decodeImage(input.data.dataUrl);
    return reply({ url: await putAsset((await workspaceFrom(request)) ?? "operator", bytes, type) });
  } catch (error) { return failure(error); }
}
