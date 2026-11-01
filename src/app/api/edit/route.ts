import { editRequest, editResponse } from "@/lib/contracts";
import { editProject } from "@/server/edit-project";
import { charge } from "@/server/workspace/http";
import { jsonRoute } from "@/server/http";

export const maxDuration = 120;
export const POST = (request: Request) => jsonRoute(editRequest, editResponse, (input, signal) => charge(request, 1, () => editProject(input, signal)))(request);
