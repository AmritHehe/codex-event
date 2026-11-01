import { generateRequest, generateResponse } from "@/lib/contracts";
import { generate } from "@/server/generation";
import { jsonRoute } from "@/server/http";

export const maxDuration = 120;
export const POST = jsonRoute(generateRequest, generateResponse, ({ url }, signal) => generate(url, signal));
