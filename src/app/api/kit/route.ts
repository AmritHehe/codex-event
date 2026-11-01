import { kitRequest, kitResponse } from "@/lib/contracts";
import { generateKit } from "@/server/kit";
import { jsonRoute } from "@/server/http";

export const maxDuration = 120;
export const POST = jsonRoute(kitRequest, kitResponse, generateKit);
