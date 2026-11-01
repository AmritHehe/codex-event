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
  if (kind === "none" || kind === "typewriter" || kind === "words") return {};
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

/** Words for word-by-word entrances; a word may span a highlight edge ("*apps*." -> one word, two parts). */
export const highlightWords = (text: string) => {
  const words: { text: string; hl: boolean }[][] = [];
  let open = false; // last word can still grow (no whitespace since)
  for (const seg of parseHighlights(text))
    for (const piece of seg.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) open = false;
      else if (open) words.at(-1)!.push({ text: piece, hl: seg.hl });
      else {
        words.push([{ text: piece, hl: seg.hl }]);
        open = true;
      }
    }
  return words;
};

const WORD_STAGGER = 4;

/** Blur-in word by word: opacity, blur and a slight scale settle, one word every few frames. */
function Words({ text, accent, f, u }: { text: string; accent: string; f: number; u: number }) {
  const { fps } = useVideoConfig();
  return (
    <>
      {highlightWords(text).map((w, i) => {
        const p = spring({ frame: f - i * WORD_STAGGER, fps, config: { damping: 200 }, durationInFrames: 9 });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.25em",
              opacity: p,
              filter: `blur(${(1 - p) * 1.2 * u}px)`,
              transform: `scale(${1.15 - 0.15 * p})`,
            }}
          >
            {w.map((part, k) => (
              <span key={k} style={part.hl ? { color: accent } : undefined}>
                {part.text}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

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
  delay: number; // scene frame this layer enters at; f + delay = frame within the scene
};

/** Scene frame where a peek presses its button; a counter with doneLabel stops just after it. */
const pressFrame = (sceneFrames: number) => Math.round(sceneFrames * 0.45);

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
  const kind = layer.enter ?? defaultEnter(layer);
  const reveal = kind === "typewriter" ? Math.floor(Math.max(0, f) * 1.6) : undefined;
  return (
    <div style={{ ...styles[layer.role], color: layer.color ?? styles[layer.role].color, textAlign: align, maxWidth: box.w }}>
      {kind === "words" ? <Words text={layer.text} accent={theme.accent} f={f} u={u} /> : <RichText text={layer.text} accent={theme.accent} reveal={reveal} />}
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
  const imgStyle: React.CSSProperties = {
    display: "block",
    maxWidth: box.w * k,
    maxHeight: box.h * k - bar,
    transform: `scale(${zoom})`,
    transformOrigin: "50% 30%",
  };
  // Inline data: images (the sample screenshot) need no loading; Remotion's <Img> decode() rejects some SVG data URIs
  // and stalls the Player, so render them with a plain <img>. Remote images keep <Img> so renders wait for them.
  // eslint-disable-next-line @next/next/no-img-element
  const img = layer.src.startsWith("data:") ? <img src={layer.src} alt="" style={imgStyle} /> : (
    <Img
      src={layer.src}
      style={imgStyle}
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
  if (layer.variant === "chips")
    return (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: box.align === "left" ? "flex-start" : "center", gap: 1.4 * u, maxWidth: box.w }}>
        {layer.items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: `${1.1 * u}px ${2.2 * u}px`,
              borderRadius: 99 * u,
              background: theme.surface,
              border: `${0.12 * u}px solid ${mix(theme.text, 10)}`,
              boxShadow: `0 ${0.8 * u}px ${2.4 * u}px ${mix(theme.text, 8)}`,
              fontFamily: font(theme.bodyFont).fontFamily,
              fontSize: 3 * u,
              fontWeight: 500,
              ...enterStyle("pop", f - i * 5, fps, u),
            }}
          >
            <RichText text={item} accent={theme.accent} />
          </div>
        ))}
      </div>
    );
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

const mono = () => font("Geist Mono").fontFamily;

/** 41 -> "0:41"; 75 -> "1:15". */
export const formatCounter = (n: number, format: "time" | "number" = "time") => {
  const v = Math.max(0, Math.round(n));
  return format === "number" ? v.toLocaleString("en-US") : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

function CheckMark({ size, color, p }: { size: number; color: string; p: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r={11 * Math.min(1, p * 1.6)} fill={color} />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, Math.max(0, p * 2 - 0.6))} />
    </svg>
  );
}

/** Mono pill that ticks from -> to; with doneLabel it stops and flips to a checked state. */
function CounterLayer({ layer, theme, box, f, sceneFrames, delay }: Props<"counter">) {
  const { u } = box;
  const { fps } = useVideoConfig();
  const run = layer.doneLabel ? Math.max(1, pressFrame(sceneFrames) + 6 - delay) : sceneFrames - delay;
  const n = interpolate(f, [0, run], [layer.from, layer.to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const done = layer.doneLabel !== undefined && f >= run;
  const pd = done ? spring({ frame: f - run, fps, config: { damping: 14 } }) : 0;
  const live = 0.5 + 0.5 * Math.sin(f / 4);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.4 * u,
        padding: `${1.1 * u}px ${2.2 * u}px`,
        borderRadius: 99 * u,
        background: done ? mix(theme.accent, 12, theme.surface) : theme.surface,
        border: `${0.12 * u}px solid ${done ? mix(theme.accent, 40) : mix(theme.text, 12)}`,
        fontFamily: mono(),
        fontSize: 2.6 * u,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: done ? theme.accent : theme.text,
        transform: `scale(${1 + 0.06 * Math.sin(pd * Math.PI)})`,
      }}
    >
      {done ? <CheckMark size={2.8 * u} color={theme.accent} p={pd} /> : <span style={{ width: 1.1 * u, height: 1.1 * u, borderRadius: "50%", background: theme.muted, opacity: 0.4 + 0.6 * live }} />}
      <span>{done ? layer.doneLabel : layer.label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", color: done ? theme.accent : theme.muted }}>{formatCounter(n, layer.format)}</span>
    </div>
  );
}

/** A card that springs out of the top edge (or a notch) and optionally presses its primary button. */
function PeekLayer({ layer, theme, box, f, sceneFrames, delay }: Props<"peek">) {
  const { u } = box;
  const { fps } = useVideoConfig();
  const notch = layer.anchor === "notch";
  const drop = spring({ frame: f, fps, config: { damping: 15, mass: 0.7 } });
  const pressAt = pressFrame(sceneFrames) - delay;
  const fp = f - pressAt;
  const pressed = layer.press && fp >= 0;
  const squeeze = layer.press && fp >= 0 && fp < 8 ? 1 - 0.07 * Math.sin((fp / 8) * Math.PI) : 1;
  const ring = pressed ? interpolate(fp, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const pc = pressed ? spring({ frame: fp - 3, fps, config: { damping: 14 } }) : 0;
  const nw = 22 * u;
  const cardW = 50 * u;
  return (
    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2 }}>
      {notch && <div style={{ width: nw, height: 3.6 * u, background: "#000", borderRadius: `0 0 ${1.6 * u}px ${1.6 * u}px` }} />}
      <div
        style={{
          marginTop: notch ? -1.2 * u : 3 * u,
          width: cardW,
          padding: `${2.6 * u}px ${2.8 * u}px`,
          borderRadius: 3 * u,
          background: notch ? "#0b0b0d" : theme.surface,
          color: notch ? "#f4f5f8" : theme.text,
          boxShadow: `0 ${2 * u}px ${6 * u}px ${mix("#000", 22)}, 0 0 0 ${0.12 * u}px ${mix(theme.text, 10)}`,
          fontFamily: font(theme.bodyFont).fontFamily,
          transformOrigin: "50% 0%",
          transform: `translateY(${(1 - drop) * -14 * u}px) scale(${interpolate(drop, [0, 1], [nw / cardW, 1])}, ${drop})`,
          opacity: Math.min(1, drop * 3),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 1.2 * u, fontSize: 3 * u, fontWeight: 600 }}>
          <span style={{ width: 1.2 * u, height: 1.2 * u, borderRadius: "50%", background: theme.accent2, flexShrink: 0 }} />
          {layer.title}
        </div>
        {layer.body && <div style={{ marginTop: 1 * u, fontSize: 2.5 * u, opacity: 0.7, lineHeight: 1.35 }}>{layer.body}</div>}
        {layer.actions?.length ? (
          <div style={{ display: "flex", gap: 1.2 * u, marginTop: 2.2 * u }}>
            {layer.actions.map((a, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 1 * u,
                  padding: `${1.2 * u}px 0`,
                  borderRadius: 1.6 * u,
                  fontSize: 2.5 * u,
                  fontWeight: 600,
                  background: i === 0 ? theme.accent : "transparent",
                  color: i === 0 ? "#fff" : "inherit",
                  border: i === 0 ? "none" : `${0.12 * u}px solid ${mix(notch ? "#fff" : theme.text, 22)}`,
                  transform: i === 0 ? `scale(${squeeze})` : undefined,
                }}
              >
                {i === 0 && pressed && <CheckMark size={2.6 * u} color={mix("#fff", 28)} p={pc} />}
                {a}
                {i === 0 && ring > 0 && ring < 1 && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 1.6 * u,
                      border: `${0.4 * u}px solid ${theme.accent}`,
                      transform: `scale(${1 + ring * 0.8})`,
                      opacity: 1 - ring,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Cluttered desktop: drawn app windows cascading in, drifting, faded at the centre so type stays legible. */
function WindowsLayer({ layer, theme, box, f }: Props<"windows">) {
  const { u } = box;
  const { fps, width, height } = useVideoConfig();
  const n = layer.titles.length;
  const cols = Math.ceil(Math.sqrt(n * (width / height)));
  const rows = Math.ceil(n / cols);
  const ww = (width / cols) * 0.86;
  const wh = (height / rows) * 0.78;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: 0,
        maskImage: "radial-gradient(ellipse 50% 30% at center, transparent 55%, black 100%)",
        transform: `translateX(${-f * 0.12 * u}px)`,
      }}
    >
      {layer.titles.map((t, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const p = spring({ frame: f - i * 3, fps, config: { damping: 16, mass: 0.6 } });
        const x = (c + 0.5) * (width / cols) - ww / 2 + (r % 2 ? 4 : -4) * u;
        const y = (r + 0.5) * (height / rows) - wh / 2 + Math.sin(f / 30 + i) * 0.8 * u;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: ww,
              height: wh,
              borderRadius: 1.8 * u,
              background: theme.surface,
              boxShadow: `0 ${1.5 * u}px ${5 * u}px ${mix(theme.text, 10)}, 0 0 0 ${0.12 * u}px ${mix(theme.text, 10)}`,
              opacity: p,
              transform: `translateY(${(1 - p) * 5 * u}px) scale(${0.94 + 0.06 * p})`,
              overflow: "hidden",
            }}
          >
            <div style={{ height: 3.4 * u, display: "flex", alignItems: "center", gap: 0.7 * u, padding: `0 ${1.4 * u}px`, borderBottom: `${0.1 * u}px solid ${mix(theme.text, 8)}` }}>
              {[0, 1, 2].map((k) => (
                <span key={k} style={{ width: 0.9 * u, height: 0.9 * u, borderRadius: "50%", background: mix(theme.text, 16) }} />
              ))}
              <span style={{ marginLeft: 1 * u, fontFamily: mono(), fontSize: 1.7 * u, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.muted }}>{t}</span>
            </div>
            <div style={{ padding: 1.6 * u, display: "flex", flexDirection: "column", gap: 1.1 * u }}>
              {[0.82, 0.6, 0.72, 0.45, 0.66].map((w, k) => (
                <span key={k} style={{ height: 1 * u, width: `${w * (0.7 + 0.3 * (((i + 1) * (k + 3)) % 5) / 5) * 100}%`, borderRadius: 0.5 * u, background: mix(theme.text, 8) }} />
              ))}
            </div>
          </div>
        );
      })}
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
  counter: "pop",
  peek: "none",
  windows: "none",
};

/** Headlines land word by word; everything else uses its type's default. */
const defaultEnter = (layer: Layer): Animation => (layer.type === "text" && layer.role === "headline" ? "words" : DEFAULT_ENTER[layer.type]);

/** Layers that position themselves against the whole scene (they must not get a containing block). */
const FREE: Layer["type"][] = ["peek", "windows"];

/** Renders any layer with its entrance animation. `delay` = frame it appears within the scene. */
export function LayerView({ layer, theme, box, delay, sceneFrames }: { layer: Layer; theme: Theme; box: Box; delay: number; sceneFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - delay;
  const kind = layer.enter ?? defaultEnter(layer);
  const style = enterStyle(kind, f, fps, box.u);
  const props = { theme, box, f, sceneFrames, delay };
  const free = FREE.includes(layer.type);
  return (
    <div style={{ ...style, opacity: f < 0 ? 0 : style.opacity, ...(!free && { position: "relative", zIndex: 1 }) }}>
      {layer.type === "text" && <TextLayer layer={layer} {...props} />}
      {layer.type === "badge" && <BadgeLayer layer={layer} {...props} />}
      {layer.type === "image" && <ImageLayer layer={layer} {...props} />}
      {layer.type === "list" && <ListLayer layer={layer} {...props} />}
      {layer.type === "stat" && <StatLayer layer={layer} {...props} />}
      {layer.type === "cta" && <CtaLayer layer={layer} {...props} />}
      {layer.type === "counter" && <CounterLayer layer={layer} {...props} />}
      {layer.type === "peek" && <PeekLayer layer={layer} {...props} />}
      {layer.type === "windows" && <WindowsLayer layer={layer} {...props} />}
    </div>
  );
}
