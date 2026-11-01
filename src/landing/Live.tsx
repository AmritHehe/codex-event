"use client";

// Remotion-backed pieces of the landing page. Loaded client-only via ./client.
import { Player, Thumbnail, type PlayerRef } from "@remotion/player";
import { useReducedMotion } from "motion/react";
import type { Ref } from "react";
import { focusFrame } from "@/editor/store";
import { LaunchVideo } from "@/video/LaunchVideo";
import { sampleProject } from "@/video/sample";
import { FPS, projectDuration } from "@/video/schema";
import { THEME_PRESETS } from "@/video/themes";

const total = projectDuration(sampleProject);

export function HeroStage({ playerRef }: { playerRef?: Ref<PlayerRef> }) {
  const reduce = useReducedMotion();
  return (
    <Player
      ref={playerRef}
      component={LaunchVideo}
      inputProps={{ project: sampleProject }}
      durationInFrames={total}
      compositionWidth={1920}
      compositionHeight={1080}
      fps={FPS}
      style={{ width: "100%", height: "100%" }}
      initialFrame={focusFrame(sampleProject, "hook")}
      autoPlay={!reduce}
      controls={!!reduce}
      loop
      acknowledgeRemotionLicense
    />
  );
}

const productFrame = focusFrame(sampleProject, "product", "d4") + 20;

/** The real engine at an arbitrary size: layout re-flows for every width/height pair. */
export function ReflowStage({ w, h, theme }: { w: number; h: number; theme: number }) {
  return (
    <Thumbnail
      component={LaunchVideo}
      inputProps={{ project: { ...sampleProject, theme: THEME_PRESETS[theme].theme } }}
      compositionWidth={w}
      compositionHeight={h}
      durationInFrames={total}
      fps={FPS}
      frameToDisplay={productFrame}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
