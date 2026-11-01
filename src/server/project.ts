import { projectSchema, type Project } from "@/video/schema";
import { ApiError } from "./http";

export function validateProject(project: Project): Project {
  const ids = new Set<string>();
  const unique = (id: string) => {
    if (!id || ids.has(id)) throw new ApiError(502, "Generated project contains duplicate or empty IDs. Please retry.");
    ids.add(id);
  };
  if (project.scenes.length > 20) throw new ApiError(502, "Generated project has too many scenes. Please retry.");
  for (const scene of project.scenes) {
    unique(scene.id);
    if (scene.layers.length > 30) throw new ApiError(502, "Generated scene has too many layers. Please retry.");
    for (const layer of scene.layers) unique(layer.id);
  }
  projectSchema.parse(project);
  return project;
}

