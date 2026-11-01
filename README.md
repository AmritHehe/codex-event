# Shipcast

Building is solved. Distribution isn't. Shipcast turns a product into launch videos, threads and memes, editable layer by layer, and gets them onto 66 channels.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000  (landing, /studio, /distribution)
pnpm studio         # Remotion Studio for the video engine
pnpm check:video    # engine self-check
pnpm lint && pnpm tsc --noEmit
```

Node 22+, pnpm.

## Render and export (Phase 4)

Run `pnpm render-server` in a second terminal. It bundles `LaunchVideo` once at startup, listens on `http://127.0.0.1:3200`, and executes one isolated render worker at a time. In Studio, open **Export**, select landscape, vertical and/or square, then render and download the MP4s. Dimensions and duration come from the composition's `calculateMetadata`, just like the Player.

Optional settings are listed in `.env.example`. Next reads `.env.local`; the standalone render process reads its shell environment, so export its settings in that terminal. Set `REMOTION_BROWSER_EXECUTABLE` to an existing Chrome/Chromium binary to skip Remotion's browser download. For a web app on a different origin, set `RENDER_ORIGINS` to a comma-separated allowlist and `NEXT_PUBLIC_RENDER_URL` before starting Next.

The service provides `POST /render` (202 with a job), `GET /render/:jobId`, and `GET /files/:jobId.mp4`. Invalid projects return 400. Jobs end in `done` or `error`; a crashed or stalled worker cannot block the queue indefinitely (8 minute maximum per job). At most 20 jobs wait at a time. Input is limited to 1 MB and 18,000 frames. Files and the reusable bundle live in gitignored `out/`. Jobs are held in memory and reset on restart; this service is for the local single-user demo.

`pnpm check:render` checks queue recovery, HTTP validation, CORS and downloads without running Chromium. `pnpm check:render:smoke` bundles once and renders the complete sample in all three ratios, checking MP4 dimensions and duration. The smoke check requires a browser and network access for the sample's Google Fonts.

## Map

| Path | What |
|---|---|
| `src/video/` | Video engine. `schema.ts` is the contract: a `Project` JSON (scenes → layers) rendered by Remotion (`LaunchVideo.tsx`). Relative imports only (Remotion bundler ignores tsconfig paths). |
| `src/editor/` | Studio editor: store (undo/redo, autosave), panels, timeline, inspector. |
| `src/distribution/` | Channel catalog (66), agents (9), hub UI. |
| `src/landing/` | Landing page sections. |
| `PLAN.md` | Phases, owners, research. |

## Working together

- `main` is always deployable. Work on a branch: `feat/<thing>`.
- One commit per feature, conventional messages (`feat(render): ...`).
- Open a PR into `main`. CI runs typecheck, lint and the engine self-check. Another person reviews and merges.
- Don't change `src/video/schema.ts` in a feature PR without calling it out in the PR description: it is shared by the editor, AI generation and the render server.

See "Two tracks" in `PLAN.md`: backend items are prefixed B, frontend items F. API shapes live in `src/lib/contracts.ts`. UI rules live in `DESIGN.md`.
