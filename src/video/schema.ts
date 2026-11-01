// Single source of truth for a video project. Validates AI output, editor state and render input.
// NOTE: files under src/video use relative imports only — the Remotion bundler ignores tsconfig paths.
import { z } from "zod";

export const FPS = 30;
export const TRANSITION_FRAMES = 15;

export const ASPECTS = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
} as const;

export const aspectSchema = z.enum(["16:9", "9:16", "1:1"]);
export const animationSchema = z.enum(["fade", "slide-up", "slide-left", "pop", "blur", "typewriter", "none"]);
export const fontSchema = z.enum([
  "Inter",
  "Space Grotesk",
  "Bricolage Grotesque",
  "Instrument Serif",
  "DM Sans",
  "Sora",
  "Syne",
  "JetBrains Mono",
]);

const layerBase = {
  id: z.string(),
  hidden: z.boolean().optional(),
  enter: animationSchema.optional(),
  delay: z.number().int().min(0).optional().describe("Frames after scene start. Omit to auto-stagger by order."),
};

export const textLayerSchema = z.object({
  ...layerBase,
  type: z.literal("text"),
  role: z.enum(["kicker", "headline", "subhead", "body"]),
  text: z.string().describe("Wrap words in *asterisks* to highlight them in the accent color."),
  color: z.string().optional(),
});

export const badgeLayerSchema = z.object({
  ...layerBase,
  type: z.literal("badge"),
  text: z.string(),
});

export const imageLayerSchema = z.object({
  ...layerBase,
  type: z.literal("image"),
  src: z.string(),
  frame: z.enum(["none", "browser", "phone"]).optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
  kenBurns: z.boolean().optional().describe("Slow zoom across the scene."),
});

export const listLayerSchema = z.object({
  ...layerBase,
  type: z.literal("list"),
  items: z.array(z.string()).min(1).max(6),
});

export const statLayerSchema = z.object({
  ...layerBase,
  type: z.literal("stat"),
  value: z.number(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  label: z.string(),
});

export const ctaLayerSchema = z.object({
  ...layerBase,
  type: z.literal("cta"),
  text: z.string(),
  url: z.string().optional(),
});

export const layerSchema = z.discriminatedUnion("type", [
  textLayerSchema,
  badgeLayerSchema,
  imageLayerSchema,
  listLayerSchema,
  statLayerSchema,
  ctaLayerSchema,
]);

export const sceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationInFrames: z.number().int().min(TRANSITION_FRAMES * 2).max(600),
  layout: z.enum(["stack", "split"]).describe("stack = centered column; split = text beside media (landscape)."),
  background: z.enum(["solid", "gradient", "mesh", "grid"]),
  transition: z.enum(["fade", "slide", "wipe", "push", "none"]).describe("Transition INTO this scene."),
  layers: z.array(layerSchema),
});

export const themeSchema = z.object({
  background: z.string(),
  surface: z.string(),
  text: z.string(),
  muted: z.string(),
  accent: z.string(),
  accent2: z.string(),
  headingFont: fontSchema,
  bodyFont: fontSchema,
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  aspect: aspectSchema,
  theme: themeSchema,
  scenes: z.array(sceneSchema).min(1),
});

export type Aspect = z.infer<typeof aspectSchema>;
export type Animation = z.infer<typeof animationSchema>;
export type FontName = z.infer<typeof fontSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type LayerType = Layer["type"];
export type Scene = z.infer<typeof sceneSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Project = z.infer<typeof projectSchema>;

const hasTransition = (s: Scene, i: number) => i > 0 && s.transition !== "none";

/** Total frames: scene lengths minus transition overlaps. */
export const projectDuration = (p: Project) =>
  p.scenes.reduce((sum, s, i) => sum + s.durationInFrames - (hasTransition(s, i) ? TRANSITION_FRAMES : 0), 0);

/** Frame at which each scene starts on the global timeline. */
export const sceneStarts = (p: Project) => {
  let t = 0;
  return p.scenes.map((s, i) => {
    if (hasTransition(s, i)) t -= TRANSITION_FRAMES;
    const start = t;
    t += s.durationInFrames;
    return start;
  });
};
