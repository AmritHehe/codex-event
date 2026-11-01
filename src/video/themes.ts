import type { Theme } from "./schema";

export const THEME_PRESETS: { name: string; theme: Theme }[] = [
  {
    name: "Paper",
    theme: { background: "#F4F4F5", surface: "#FFFFFF", text: "#18181B", muted: "#62626B", accent: "#2F54EB", accent2: "#9DB4FF", headingFont: "Bricolage Grotesque", bodyFont: "Inter" },
  },
  {
    name: "Volt",
    theme: { background: "#0B0B0F", surface: "#16161D", text: "#F5F5F7", muted: "#9A9AA6", accent: "#C6FF3D", accent2: "#3B6CFF", headingFont: "Bricolage Grotesque", bodyFont: "Inter" },
  },
  {
    name: "Cobalt",
    theme: { background: "#0B1D4A", surface: "#132A63", text: "#F3F6FF", muted: "#A9B6DA", accent: "#FFD23F", accent2: "#3D7BFF", headingFont: "Space Grotesk", bodyFont: "DM Sans" },
  },
  {
    name: "Forest",
    theme: { background: "#10261B", surface: "#183626", text: "#EEF0E8", muted: "#A6B3A8", accent: "#F2B33D", accent2: "#3E8A5F", headingFont: "Syne", bodyFont: "DM Sans" },
  },
  {
    name: "Mono",
    theme: { background: "#FAFAFA", surface: "#FFFFFF", text: "#111113", muted: "#6E6E73", accent: "#111113", accent2: "#C9C9CE", headingFont: "Sora", bodyFont: "Inter" },
  },
  {
    name: "Terminal",
    theme: { background: "#0D1117", surface: "#161B22", text: "#E6EDF3", muted: "#8B949E", accent: "#3FB950", accent2: "#1F6FEB", headingFont: "JetBrains Mono", bodyFont: "JetBrains Mono" },
  },
];
