import { editRequest, editResponse } from "@/lib/contracts";
import { editProject } from "@/server/edit-project";
import { jsonRoute } from "@/server/http";

export const maxDuration = 120;
export const POST = jsonRoute(editRequest, editResponse, editProject);
