// Self-check for the video engine's pure logic. Run: pnpm check:video
import assert from "node:assert/strict";
import { parseHighlights } from "../src/video/layers";
import { sampleProject } from "../src/video/sample";
import { projectDuration, projectSchema, sceneStarts } from "../src/video/schema";

projectSchema.parse(sampleProject);

// 6 scenes = 520 frames, 5 transitions x 15 frames overlap
assert.equal(projectDuration(sampleProject), 445);
assert.deepEqual(sceneStarts(sampleProject), [0, 60, 120, 215, 300, 355]);

const noTransitions = { ...sampleProject, scenes: sampleProject.scenes.map((s) => ({ ...s, transition: "none" as const })) };
assert.equal(projectDuration(noTransitions), 520);

assert.deepEqual(parseHighlights("Ship it *loud*"), [
  { text: "Ship it ", hl: false },
  { text: "loud", hl: true },
]);

console.log("video engine ok");
