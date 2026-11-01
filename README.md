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

See **Phase 4** in `PLAN.md` for the render-server work package.
