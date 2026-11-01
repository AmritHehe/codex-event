import { Composition } from "remotion";
import { LaunchVideo, type LaunchVideoProps } from "./LaunchVideo";
import { sampleProject } from "./sample";
import { ASPECTS, FPS, projectDuration } from "./schema";

// Used by Remotion Studio (`pnpm studio`) and the render server. Size/length come from the project props.
export function Root() {
  return (
    <Composition
      id="LaunchVideo"
      component={LaunchVideo}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={projectDuration(sampleProject)}
      defaultProps={{ project: sampleProject } satisfies LaunchVideoProps}
      calculateMetadata={({ props }) => ({
        ...ASPECTS[props.project.aspect],
        durationInFrames: projectDuration(props.project),
      })}
    />
  );
}
