import { failure, reply } from "@/server/distribution/http";
import { popularTemplates, templateImage } from "@/server/distribution/templates";
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
    const id = new URL(request.url).searchParams.get("id");
    return reply(id ? { dataUrl: await templateImage(id, signal) } : { templates: await popularTemplates(signal) });
  } catch (error) { return failure(error); }
}
