import { projectSchema, type Project } from "@/video/schema";

export const PROJECT_STORAGE_KEY = "shipcast:project";

export function readProject(): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    return raw ? projectSchema.parse(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function saveProject(project: Project) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
}
