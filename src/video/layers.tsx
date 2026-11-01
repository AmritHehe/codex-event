import type React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { font } from "./fonts";
import type { Animation, Layer, Theme } from "./schema";

export type Box = { w: number; h: number; u: number; align: "left" | "center" };

/** 1u = 1% of the short side; portrait gets bigger type since it's watched full-screen on phones. */
export const unit = (width: number, height: number) => (Math.min(width, height) / 100) * (height > width ? 1.3 : 1);

export const mix = (color: string, pct: number, base = "transparent") =>
  `color-mix(in srgb, ${color} ${pct}%, ${base})`;

/** Entrance animation as a style, driven by frames since the layer appeared. */
export function enterStyle(kind: Animation, f: number, fps: number, u: number): React.CSSProperties {
  if (kind === "none" || kind === "typewriter") return {};
  const p = spring({ frame: f, fps, config: kind === "pop" ? { damping: 11, mass: 0.6 } : { damping: 200 } });
  const opacity = Math.min(1, Math.max(0, kind === "pop" ? p * 2 : p));
  switch (kind) {
    case "fade":
      return { opacity };
    case "slide-up":
      return { opacity, transform: `translateY(${(1 - p) * 6 * u}px)` };
    case "slide-left":
      return { opacity, transform: `translateX(${(1 - p) * 8 * u}px)` };
    case "pop":
      return { opacity, transform: `scale(${0.5 + 0.5 * p})` };
    case "blur":
      return { opacity, filter: `blur(${(1 - p) * 3 * u}px)`, transform: `scale(${1.08 - 0.08 * p})` };
  }
}

/** "Ship it *loud*" -> [{text:"Ship it ",hl:false},{text:"loud",hl:true}] */
export const parseHighlights = (text: string) =>
  text.split("*").map((t, i) => ({ text: t, hl: i % 2 === 1 })).filter((s) => s.text);

function RichText({ text, accent, reveal }: { text: string; accent: string; reveal?: number }) {
  const segments = parseHighlights(text);
  const offsets = segments.map((_, i) => segments.slice(0, i).reduce((n, s) => n + s.text.length, 0));
  return (
    <>
      {segments.map((s, i) => (
        <span key={i} style={s.hl ? { color: accent } : undefined}>
          {s.text.slice(0, Math.max(0, (reveal ?? Infinity) - offsets[i]))}
        </span>
      ))}
    </>
  );
}

type Props<T extends Layer["type"]> = {
  layer: Extract<Layer, { type: T }>;
  theme: Theme;
  box: Box;
  f: number; // frames since this layer's entrance
  sceneFrames: number;
};

function TextLayer({ layer, theme, box, f }: Props<"text">) {
  const { u, align } = box;
  const heading = font(theme.headingFont);
  const body = font(theme.bodyFont);
  const styles: Record<typeof layer.role, React.CSSProperties> = {
    kicker: { fontSize: 3 * u, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: theme.accent, fontFamily: body.fontFamily },
    headline: { fontSize: 8.5 * u, fontWeight: heading.headingWeight, lineHeight: 1.02, letterSpacing: "-0.035em", fontFamily: heading.fontFamily, textWrap: "balance" },
    subhead: { fontSize: 4.2 * u, fontWeight: 500, lineHeight: 1.25, color: theme.muted, fontFamily: body.fontFamily, textWrap: "balance" },
    body: { fontSize: 3.3 * u, fontWeight: 400, lineHeight: 1.4, color: theme.muted, fontFamily: body.fontFamily, textWrap: "pretty" },
  };
  const reveal = layer.enter === "typewriter" ? Math.floor(Math.max(0, f) * 1.6) : undefined;
  return (
    <div style={{ ...styles[layer.role], color: layer.color ?? styles[layer.role].color, textAlign: align, maxWidth: box.w }}>
      <RichText text={layer.text} accent={theme.accent} reveal={reveal} />
    </div>
  );
}

function BadgeLayer({ layer, theme, box }: Props<"badge">) {
  const { u } = box;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.2 * u,
        padding: `${1 * u}px ${2.4 * u}px`,
        borderRadius: 99 * u,
        border: `${0.2 * u}px solid ${mix(theme.accent, 45)}`,
        background: mix(theme.accent, 14),
        color: theme.accent,
        fontSize: 2.6 * u,
        fontWeight: 600,
        fontFamily: font(theme.bodyFont).fontFamily,
      }}
    >
      <span style={{ width: 1.2 * u, height: 1.2 * u, borderRadius: "50%", background: theme.accent }} />
      {layer.text}
    </div>
  );
}

const IMAGE_SIZE = { sm: 0.45, md: 0.65, lg: 0.85 };

function ImageLayer({ layer, theme, box, f, sceneFrames }: Props<"image">) {
  const { u } = box;
  const k = IMAGE_SIZE[layer.size ?? "lg"];
  const frame = layer.frame ?? "browser";
  const bar = frame === "browser" ? 3.4 * u : 0;
  const zoom = layer.kenBurns ? interpolate(f, [0, sceneFrames], [1, 1.12], { extrapolateRight: "clamp" }) : 1;
  const img = (
    <Img
      src={layer.src}
      style={{
        display: "block",
        maxWidth: box.w * k,
        maxHeight: box.h * k - bar,
        transform: `scale(${zoom})`,
        transformOrigin: "50% 30%",
      }}
    />
  );
  if (frame === "none") return <div style={{ borderRadius: 1.6 * u, overflow: "hidden" }}>{img}</div>;
  const shadow = `0 ${3 * u}px ${8 * u}px ${mix("#000", 45)}, 0 0 0 ${0.15 * u}px ${mix(theme.text, 12)}`;
  if (frame === "phone")
    return (
      <div style={{ borderRadius: 5 * u, padding: 1 * u, background: "#0a0a0a", boxShadow: shadow, overflow: "hidden" }}>
        <div style={{ borderRadius: 4 * u, overflow: "hidden" }}>{img}</div>
      </div>
    );
  return (
    <div style={{ borderRadius: 1.6 * u, overflow: "hidden", background: theme.surface, boxShadow: shadow }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 0.8 * u, paddingLeft: 1.6 * u }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 1.1 * u, height: 1.1 * u, borderRadius: "50%", background: c }} />
        ))}
      </div>
      <div style={{ overflow: "hidden" }}>{img}</div>
    </div>
  );
}

function ListLayer({ layer, theme, box, f }: Props<"list">) {
  const { u } = box;
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 * u, fontFamily: font(theme.bodyFont).fontFamily }}>
      {layer.items.map((item, i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 2 * u, fontSize: 4 * u, fontWeight: 500, ...enterStyle("slide-left", f - i * 6, fps, u) }}
        >
          <span
            style={{
              width: 4.4 * u,
              height: 4.4 * u,
              flexShrink: 0,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: theme.accent,
              color: theme.background,
              fontSize: 2.6 * u,
              fontWeight: 800,
            }}
          >
            ✓
          </span>
          <RichText text={item} accent={theme.accent} />
        </div>
      ))}
    </div>
  );
}

function StatLayer({ layer, theme, box, f }: Props<"stat">) {
  const { u, align } = box;
  const heading = font(theme.headingFont);
  const n = interpolate(f, [0, 40], [0, layer.value], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const decimals = Number.isInteger(layer.value) ? 0 : 1;
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: 18 * u, lineHeight: 1, fontWeight: heading.headingWeight, fontFamily: heading.fontFamily, letterSpacing: "-0.04em", color: theme.accent, fontVariantNumeric: "tabular-nums" }}>
        {layer.prefix}
        {n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {layer.suffix}
      </div>
      <div style={{ fontSize: 3.6 * u, color: theme.muted, fontFamily: font(theme.bodyFont).fontFamily, marginTop: 1 * u }}>{layer.label}</div>
    </div>
  );
}

function CtaLayer({ layer, theme, box, f }: Props<"cta">) {
  const { u } = box;
  const pulse = 1 + 0.025 * Math.sin(Math.max(0, f - 20) / 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.6 * u, fontFamily: font(theme.bodyFont).fontFamily }}>
      <div
        style={{
          padding: `${2 * u}px ${4.4 * u}px`,
          borderRadius: 99 * u,
          background: theme.accent,
          color: theme.background,
          fontSize: 4.2 * u,
          fontWeight: 700,
          transform: `scale(${pulse})`,
          boxShadow: `0 ${1.5 * u}px ${6 * u}px ${mix(theme.accent, 40)}`,
        }}
      >
        {layer.text} →
      </div>
      {layer.url && <div style={{ fontSize: 2.8 * u, color: theme.muted }}>{layer.url}</div>}
    </div>
  );
}

const DEFAULT_ENTER: Record<Layer["type"], Animation> = {
  text: "slide-up",
  badge: "pop",
  image: "blur",
  list: "none",
  stat: "fade",
  cta: "pop",
};

/** Renders any layer with its entrance animation. `delay` = frame it appears within the scene. */
export function LayerView({ layer, theme, box, delay, sceneFrames }: { layer: Layer; theme: Theme; box: Box; delay: number; sceneFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - delay;
  const kind = layer.enter ?? DEFAULT_ENTER[layer.type];
  const style = enterStyle(kind, f, fps, box.u);
  const props = { theme, box, f, sceneFrames };
  return (
    <div style={{ ...style, opacity: f < 0 ? 0 : style.opacity }}>
      {layer.type === "text" && <TextLayer layer={layer} {...props} />}
      {layer.type === "badge" && <BadgeLayer layer={layer} {...props} />}
      {layer.type === "image" && <ImageLayer layer={layer} {...props} />}
      {layer.type === "list" && <ListLayer layer={layer} {...props} />}
      {layer.type === "stat" && <StatLayer layer={layer} {...props} />}
      {layer.type === "cta" && <CtaLayer layer={layer} {...props} />}
    </div>
  );
}
