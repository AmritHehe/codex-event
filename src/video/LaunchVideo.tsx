import { linearTiming, TransitionSeries, type TransitionPresentation, type TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { iris } from "@remotion/transitions/iris";
import { pushCut } from "@remotion/transitions/push-cut";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { CSSProperties } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LayerView, mix, unit, type Box } from "./layers";
import { font } from "./fonts";
import { autoDelay, TRANSITION_FRAMES, type Project, type Scene, type Theme } from "./schema";

function Background({ kind, theme }: { kind: Scene["background"]; theme: Theme }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = unit(width, height);
  const bg = theme.background;
  if (kind === "solid") return <AbsoluteFill style={{ background: bg }} />;
  if (kind === "gradient")
    return <AbsoluteFill style={{ background: `linear-gradient(160deg, ${bg} 30%, ${mix(theme.accent2, 35, bg)} 100%)` }} />;
  if (kind === "grid") {
    const line = mix(theme.text, 7);
    return (
      <AbsoluteFill style={{ background: bg }}>
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
            backgroundSize: `${8 * u}px ${8 * u}px`,
            backgroundPosition: `0 ${frame * 0.3}px`,
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          }}
        />
      </AbsoluteFill>
    );
  }
  // mesh: drifting blurred blobs
  const blob = (color: string, x: number, y: number, phase: number) => (
    <div
      style={{
        position: "absolute",
        left: `${x + Math.sin(frame / 40 + phase) * 8}%`,
        top: `${y + Math.cos(frame / 50 + phase) * 8}%`,
        width: 70 * u,
        height: 70 * u,
        borderRadius: "50%",
        background: color,
        filter: `blur(${18 * u}px)`,
        opacity: 0.5,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      {blob(theme.accent2, 20, 25, 0)}
      {blob(theme.accent, 85, 80, 2)}
      {blob(theme.accent2, 75, 10, 4)}
    </AbsoluteFill>
  );
}

/** The camera never parks: a slow push with a sideways drift a quarter-cycle out of phase. */
function breath(frame: number, frames: number, u: number) {
  const t = frame / Math.max(1, frames);
  const s = 1.015 + 0.035 * Easing.inOut(Easing.sin)(Math.min(1, t));
  return `scale(${s}) translate(${Math.sin(t * Math.PI * 1.5) * 0.6 * u}px, ${Math.cos(t * Math.PI) * -0.3 * u}px)`;
}

export function SceneView({ scene, theme }: { scene: Scene; theme: Theme }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = unit(width, height);
  const pad = 7 * u;
  const split = scene.layout === "split" && width > height;
  const visible = scene.layers.filter((l) => !l.hidden);
  const delays = new Map(visible.map((l, i) => [l.id, l.delay ?? autoDelay(i)]));

  const inner = { w: width - pad * 2, h: height - pad * 2 };
  const textBox: Box = { u, w: split ? inner.w * 0.42 : inner.w * 0.9, h: inner.h, align: split ? "left" : "center" };
  const mediaBox: Box = { u, w: split ? inner.w * 0.58 : inner.w, h: inner.h, align: "center" };

  const render = (layers: typeof visible, box: Box) =>
    layers.map((l) => (
      <LayerView key={l.id} layer={l} theme={theme} box={l.type === "image" ? mediaBox : box} delay={delays.get(l.id)!} sceneFrames={scene.durationInFrames} />
    ));

  const column = (align: Box["align"]): CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    alignItems: align === "left" ? "flex-start" : "center",
    justifyContent: "center",
    gap: 2.6 * u,
  });

  return (
    <AbsoluteFill style={{ color: theme.text, fontFamily: font(theme.bodyFont).fontFamily, transform: breath(frame, scene.durationInFrames, u) }}>
      <Background kind={scene.background} theme={theme} />
      <AbsoluteFill style={{ padding: pad, ...column("center"), ...(split && { flexDirection: "row", gap: 5 * u }) }}>
        {split ? (
          <>
            <div style={{ ...column("left"), width: textBox.w }}>{render(visible.filter((l) => l.type !== "image"), textBox)}</div>
            <div style={{ ...column("center"), width: mediaBox.w }}>{render(visible.filter((l) => l.type === "image"), mediaBox)}</div>
          </>
        ) : (
          render(visible, textBox)
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

type Css = (p: number, entering: boolean) => CSSProperties;

/** A transition as two pure style functions of progress (exiting scene, entering scene). */
function cssPresentation(style: Css): TransitionPresentation<Record<string, never>> {
  function Presentation({ children, presentationProgress: p, presentationDirection }: TransitionPresentationComponentProps<Record<string, never>>) {
    return <AbsoluteFill style={style(p, presentationDirection === "entering")}>{children}</AbsoluteFill>;
  }
  return { component: Presentation, props: {} };
}

const easeIn = Easing.in(Easing.cubic);
const easeOut = Easing.out(Easing.exp);

/** Push-through cut: the old scene accelerates into the lens, the new one decelerates out of it. */
const zoomThrough: Css = (p, entering) =>
  entering
    ? { transform: `scale(${1.12 - 0.12 * easeOut(p)})`, opacity: interpolate(p, [0.35, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), filter: `blur(${(1 - easeOut(p)) * 10}px)` }
    : { transform: `scale(${1 + 1.4 * easeIn(p)})`, filter: `blur(${easeIn(p) * 18}px)` };

const whipEase = Easing.inOut(Easing.exp);

/** Whip pan: both scenes ride one strip leftward; speed spikes mid-move and the blur follows it. */
const whip: Css = (p, entering) => {
  const x = (entering ? 1 - whipEase(p) : -whipEase(p)) * 100;
  return { transform: `translateX(${x}%)`, filter: `blur(${Math.sin(Math.PI * p) ** 3 * 22}px)` };
};

// Each presentation has its own props type; the series only needs "some presentation".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentations = (width: number, height: number): Record<Exclude<Scene["transition"], "none">, () => TransitionPresentation<any>> => ({
  zoom: () => cssPresentation(zoomThrough),
  whip: () => cssPresentation(whip),
  ring: () => iris({ width, height }),
  fade: () => fade(),
  slide: () => slide({ direction: "from-right" }),
  wipe: () => wipe({ direction: "from-left" }),
  push: () => pushCut(),
});

export type LaunchVideoProps = { project: Project };

export function LaunchVideo({ project }: LaunchVideoProps) {
  const { scenes, theme } = project;
  const { width, height } = useVideoConfig();
  const PRESENTATIONS = presentations(width, height);
  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <TransitionSeries>
        {scenes.flatMap((scene, i) => {
          const items = [];
          if (i > 0 && scene.transition !== "none")
            items.push(
              <TransitionSeries.Transition
                key={`t-${scene.id}`}
                presentation={PRESENTATIONS[scene.transition]()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          items.push(
            <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames} name={scene.name}>
              <SceneView scene={scene} theme={theme} />
            </TransitionSeries.Sequence>,
          );
          return items;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
