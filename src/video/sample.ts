import type { Project } from "./schema";

// Mock app screenshot as an inline SVG so the sample works offline, in the Player and in renders.
const bars = [40, 65, 52, 80, 70, 95, 88]
  .map((h, i) => `<rect x="${560 + i * 120}" y="${860 - h * 4}" width="70" height="${h * 4}" rx="10" fill="${i === 5 ? "#C6FF3D" : "#7C5CFF"}" opacity="${i === 5 ? 1 : 0.55}"/>`)
  .join("");
const card = (x: number, label: string, value: string) =>
  `<rect x="${x}" y="150" width="360" height="170" rx="20" fill="#1C1C25"/><text x="${x + 32}" y="205" fill="#8A8A99" font-size="24" font-family="sans-serif">${label}</text><text x="${x + 32}" y="280" fill="#F5F5F7" font-size="56" font-weight="700" font-family="sans-serif">${value}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#111117"/><rect width="300" height="1000" fill="#16161D"/><rect x="40" y="50" width="160" height="28" rx="8" fill="#C6FF3D"/>${[140, 200, 260, 320, 380]
  .map((y, i) => `<rect x="40" y="${y}" width="${200 - i * 18}" height="18" rx="6" fill="#2A2A35"/>`)
  .join("")}${card(360, "Videos shipped", "128")}${card(760, "Views", "2.4M")}${card(1160, "Posts", "512")}<rect x="360" y="360" width="1160" height="560" rx="20" fill="#1C1C25"/>${bars}</svg>`;

export const MOCK_SCREENSHOT = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const sampleProject: Project = {
  id: "sample",
  name: "Shipcast launch",
  aspect: "16:9",
  theme: {
    background: "#0B0B0F",
    surface: "#16161D",
    text: "#F5F5F7",
    muted: "#9A9AA6",
    accent: "#C6FF3D",
    accent2: "#7C5CFF",
    headingFont: "Bricolage Grotesque",
    bodyFont: "Inter",
  },
  scenes: [
    {
      id: "hook",
      name: "Hook",
      durationInFrames: 75,
      layout: "stack",
      background: "mesh",
      transition: "none",
      layers: [
        { id: "h1", type: "badge", text: "Launching today" },
        { id: "h2", type: "text", role: "headline", text: "You *built* it." },
        { id: "h3", type: "text", role: "subhead", text: "Now who's going to see it?" },
      ],
    },
    {
      id: "problem",
      name: "Problem",
      durationInFrames: 75,
      layout: "stack",
      background: "grid",
      transition: "push",
      layers: [
        { id: "p1", type: "text", role: "kicker", text: "The new bottleneck" },
        { id: "p2", type: "text", role: "headline", text: "Building is solved. *Distribution* isn't.", enter: "blur" },
      ],
    },
    {
      id: "product",
      name: "Product",
      durationInFrames: 110,
      layout: "split",
      background: "gradient",
      transition: "wipe",
      layers: [
        { id: "d1", type: "text", role: "kicker", text: "Meet Shipcast" },
        { id: "d2", type: "text", role: "headline", text: "Paste a URL. Get a *launch video*." },
        { id: "d3", type: "text", role: "body", text: "Editable layer by layer. Posted everywhere." },
        { id: "d4", type: "image", src: MOCK_SCREENSHOT, frame: "browser", size: "lg", kenBurns: true },
      ],
    },
    {
      id: "features",
      name: "Features",
      durationInFrames: 100,
      layout: "stack",
      background: "mesh",
      transition: "slide",
      layers: [
        { id: "f1", type: "text", role: "headline", text: "Everything to *ship loud*" },
        { id: "f2", type: "list", items: ["Launch videos in 60 seconds", "Memes, threads & UGC", "Edit by chat or by layer", "Post to X, TikTok, LinkedIn"] },
      ],
    },
    {
      id: "stat",
      name: "Stat",
      durationInFrames: 70,
      layout: "stack",
      background: "solid",
      transition: "fade",
      layers: [{ id: "s1", type: "stat", value: 60, suffix: "s", label: "from URL to launch video" }],
    },
    {
      id: "cta",
      name: "CTA",
      durationInFrames: 90,
      layout: "stack",
      background: "mesh",
      transition: "fade",
      layers: [
        { id: "c1", type: "text", role: "headline", text: "Ship it. *Loud.*", enter: "pop" },
        { id: "c2", type: "cta", text: "Try Shipcast free" },
      ],
    },
  ],
};
