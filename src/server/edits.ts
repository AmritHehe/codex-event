import { z } from "zod";
import { layerSchema, projectSchema, sceneSchema, themeSchema, type Project } from "@/video/schema";
import { ApiError } from "./http";
import { validateProject } from "./project";

export const editPlanSchema = z.object({
  summary: z.string().min(1).max(240),
  operations: z.array(z.discriminatedUnion("op", [
    z.object({ op: z.literal("project"), patch: projectSchema.pick({ name: true, aspect: true }).partial() }),
    z.object({ op: z.literal("theme"), patch: themeSchema.partial() }),
    z.object({ op: z.literal("scene"), sceneId: z.string(), patch: sceneSchema.omit({ id: true, layers: true }).partial() }),
    z.object({ op: z.literal("replace-layer"), sceneId: z.string(), layerId: z.string(), layer: layerSchema }),
    z.object({ op: z.literal("add-layer"), sceneId: z.string(), layer: layerSchema }),
    z.object({ op: z.literal("delete-layer"), sceneId: z.string(), layerId: z.string() }),
    z.object({ op: z.literal("add-scene"), scene: sceneSchema }),
    z.object({ op: z.literal("delete-scene"), sceneId: z.string() }),
  ])).max(30),
});

/** Apply only addressed changes. IDs and objects outside the edit remain untouched. */
export function applyEdits(project: Project, raw: z.infer<typeof editPlanSchema>) {
  const plan = editPlanSchema.parse(raw);
  let next = project;
  const invalid = () => new ApiError(502, "The edit referenced a missing scene or layer. Please retry.");
  for (const edit of plan.operations) {
    if (edit.op === "project") next = { ...next, ...edit.patch };
    else if (edit.op === "theme") next = { ...next, theme: { ...next.theme, ...edit.patch } };
    else if (edit.op === "add-scene") next = { ...next, scenes: [...next.scenes, edit.scene] };
    else {
      if (!next.scenes.some((s) => s.id === edit.sceneId)) throw invalid();
      if (edit.op === "delete-scene") {
        if (next.scenes.length === 1) throw new ApiError(502, "An edit must leave at least one scene.");
        next = { ...next, scenes: next.scenes.filter((s) => s.id !== edit.sceneId) };
      } else {
        next = { ...next, scenes: next.scenes.map((scene) => {
          if (scene.id !== edit.sceneId) return scene;
          if (edit.op === "scene") return { ...scene, ...edit.patch };
          if (edit.op === "add-layer") return { ...scene, layers: [...scene.layers, edit.layer] };
          if (!scene.layers.some((l) => l.id === edit.layerId)) throw invalid();
          if (edit.op === "delete-layer") return { ...scene, layers: scene.layers.filter((l) => l.id !== edit.layerId) };
          return { ...scene, layers: scene.layers.map((l) => l.id === edit.layerId ? { ...edit.layer, id: l.id } : l) };
        }) };
      }
    }
  }
  return { project: validateProject(next), summary: plan.summary };
}
