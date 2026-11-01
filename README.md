# Shipcast

Building is solved. Distribution isn't. Shipcast turns a product into launch videos, threads and memes, editable layer by layer, and gets them onto 66 channels.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000  (landing, /studio, /distribution)
pnpm studio         # Remotion Studio for the video engine
pnpm check:video    # engine self-check
pnpm check:ai       # API/service regressions; no credentials or paid calls
pnpm lint && pnpm tsc --noEmit
```

Node 22+, pnpm.

## AI generation (Phase 3)

Copy `.env.example` to `.env.local` and fill in the server-only keys:

- `FIRECRAWL_API_KEY`: connect Firecrawl through [Vercel Marketplace](https://vercel.com/marketplace/firecrawl) (`vercel integration add firecrawl`, then `vercel env pull .env.local`), or use an existing Firecrawl key.
- `AI_GATEWAY_API_KEY`: an API key from [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). Vercel OIDC (`VERCEL_OIDC_TOKEN`) also works. Set `AI_MODEL` to change providers without changing code.

Restart `pnpm dev` after changing environment variables. Missing credentials return a clear 503 error; provider calls are never made from the browser. Firecrawl's [v2 scrape endpoint](https://docs.firecrawl.dev/api-reference/endpoint/scrape) supplies markdown, brand colors, logo, and screenshot. [AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) validates every generation against zod. Screenshot URLs from Firecrawl expire, so regenerate before exporting an old project.

1. Paste a public product URL on the landing page or in Studio. Generation creates an editable five-scene video using the real screenshot. In Studio, replacing a project is undoable.
2. Select a scene or layer and use the instruction bar. A successful edit is one undo step. If you edit the project while waiting, the AI result is discarded so it cannot overwrite your changes.
3. Click **Distribute** to save the current project immediately. Pick channels in **Your launch kit**, generate copy, edit the drafts, and copy them. Drafts save locally; a notice marks drafts from an earlier project version. Nothing is posted automatically.

`POST /api/generate`, `/api/edit`, and `/api/kit` follow `src/lib/contracts.ts`. Errors use `{ error: string }`: 400 invalid input, 413 request over 1 MB, 415 wrong content type, 503 missing configuration, 502 provider/validation failure, 504 timeout. Cancellation is supported in all three UI flows. This remains the plan's single-user localStorage demo; configure access control before exposing paid endpoints on a public deployment.

## Map

| Path | What |
|---|---|
| `src/video/` | Video engine. `schema.ts` is the contract: a `Project` JSON (scenes → layers) rendered by Remotion (`LaunchVideo.tsx`). Relative imports only (Remotion bundler ignores tsconfig paths). |
| `server/` | [Render and export service](docs/render.md). |
| `src/editor/` | Studio editor: store (undo/redo, autosave), panels, timeline, inspector. |
| `src/distribution/` | Channel catalog (66), agents (9), hub UI and [distribution workspace](docs/distribution.md). |
| `src/landing/` | Landing page sections. |
| `PLAN.md` | Phases, owners, research. |

## Working together

- `main` is always deployable. Work on a branch: `feat/<thing>`.
- One commit per feature, conventional messages (`feat(render): ...`).
- Open a PR into `main`. CI runs typecheck, lint and the engine self-check. Another person reviews and merges.
- Don't change `src/video/schema.ts` in a feature PR without calling it out in the PR description: it is shared by the editor, AI generation and the render server.

See "Two tracks" in `PLAN.md`: backend items are prefixed B, frontend items F. API shapes live in `src/lib/contracts.ts`. UI rules live in `DESIGN.md`.
