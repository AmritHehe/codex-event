import type { Project } from "@/video/schema";

const escape = (text: string) => text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
function lines(text: string, max = 28, count = 3) {
  const result: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).flatMap((word) => word.match(new RegExp(`.{1,${max}}`, "gu")) ?? [])) {
    if (line && line.length + word.length + 1 > max) { result.push(line); line = ""; }
    line += `${line ? " " : ""}${word}`;
  }
  if (line) result.push(line);
  return result.slice(0, count);
}

/** A still composition with independently editable template, captions and product layers. */
export function memeSvg(image: string, top: string, bottom: string, project: Pick<Project, "name" | "theme">, layout: "bands" | "right-panels" = "bands") {
  // Only embedded raster images enter the exported SVG. No external fetches or markup.
  if (!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(image)) throw new Error("Load a template image before exporting.");
  const panels = layout === "right-panels";
  const text = (value: string, y: number) => lines(value, panels ? 20 : 28, panels ? 4 : 3).map((line, i) => `<text x="${panels ? 780 : 540}" y="${y + i * (panels ? 52 : 64)}" text-anchor="middle" font-family="Impact,Arial,sans-serif" font-weight="800" font-size="${panels ? 42 : 60}" fill="${panels ? "#111" : "white"}" stroke="${panels ? "white" : "#111"}" stroke-width="${panels ? 2 : 6}" paint-order="stroke">${escape(line)}</text>`).join("");
  const accent = /^#[\da-f]{3}([\da-f]{3})?$/i.test(project.theme.accent) ? project.theme.accent : "#ff4f17";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#f4f4f2"/><image href="${image}" x="0" y="0" width="1080" height="948" preserveAspectRatio="xMidYMid meet"/>${text(top, panels ? 175 : 80)}${text(bottom, panels ? 650 : 740)}<rect y="948" width="1080" height="132" fill="#111"/><rect y="948" width="12" height="132" fill="${accent}"/><text x="48" y="1025" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="#f4f4f2">${escape(project.name.slice(0, 45))}</text></svg>`;
}

export async function downloadMeme(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1080;
    const context = canvas.getContext("2d"); if (!context) throw new Error("Image export is unavailable in this browser.");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((data) => data ? resolve(data) : reject(new Error("PNG export failed.")), "image/png"));
    const download = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = download; link.download = "launch-meme.png"; link.click();
    setTimeout(() => URL.revokeObjectURL(download), 30_000);
  } finally { URL.revokeObjectURL(url); }
}
