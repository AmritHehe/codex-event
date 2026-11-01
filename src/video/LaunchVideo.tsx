import { linearTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { pushCut } from "@remotion/transitions/push-cut";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { LayerView, mix, unit, type Box } from "./layers";
import { font } from "./fonts";
import { TRANSITION_FRAMES, type Project, type Scene, type Theme } from "./schema";

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

export function SceneView({ scene, theme }: { scene: Scene; theme: Theme }) {
  const { width, height } = useVideoConfig();
  const u = unit(width, height);
  const pad = 7 * u;
  const split = scene.layout === "split" && width > height;
  const visible = scene.layers.filter((l) => !l.hidden);
  const delays = new Map(visible.map((l, i) => [l.id, l.delay ?? 6 + i * 8]));

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
    <AbsoluteFill style={{ color: theme.text, fontFamily: font(theme.bodyFont).fontFamily }}>
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

// Each presentation has its own props type; the series only needs "some presentation".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRESENTATIONS: Record<Exclude<Scene["transition"], "none">, () => TransitionPresentation<any>> = {
  fade: () => fade(),
  slide: () => slide({ direction: "from-right" }),
  wipe: () => wipe({ direction: "from-left" }),
  push: () => pushCut(),
};

export type LaunchVideoProps = { project: Project };

export function LaunchVideo({ project }: LaunchVideoProps) {
  const { scenes, theme } = project;
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
