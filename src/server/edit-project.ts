import { z } from "zod";
import { editRequest } from "@/lib/contracts";
import { applyEdits, editPlanSchema } from "./edits";
import { providers, type Providers } from "./providers";

export async function editProject(input: z.infer<typeof editRequest>, signal: AbortSignal, deps: Providers = providers) {
  const plan = await deps.structured(editPlanSchema,
    "Edit the video using the smallest set of targeted operations. Preserve all untouched content and IDs. For replace-layer, provide the complete updated layer, preserving its existing id. New layers/scenes need new unique IDs. Use selection as the target when the instruction is ambiguous. Never delete the last scene. Return a concise one-line summary of changes. If no change is needed, return no operations and explain why.",
    input, signal);
  return applyEdits(input.project, plan);
}
