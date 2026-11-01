# Render and export (Phase 4)

Run `pnpm render-server` in a second terminal. It bundles `LaunchVideo` once at startup, listens on `http://127.0.0.1:3200`, and executes one isolated render worker at a time. In Studio, open **Export**, select landscape, vertical and/or square, then render and download the MP4s. Dimensions and duration come from the composition's `calculateMetadata`, just like the Player.

Optional settings are listed in `server/render.env.example`. Next reads `.env.local`; the standalone render process reads its shell environment, so export its settings in that terminal. Set `REMOTION_BROWSER_EXECUTABLE` to an existing Chrome/Chromium binary to skip Remotion's browser download. For a web app on a different origin, set `RENDER_ORIGINS` to a comma-separated allowlist and `NEXT_PUBLIC_RENDER_URL` before starting Next.

The service provides `POST /render` (202 with a job), `GET /render/:jobId`, and `GET /files/:jobId.mp4`. Invalid projects return 400. Jobs end in `done` or `error`; a crashed or stalled worker cannot block the queue indefinitely (8 minute maximum per job). At most 20 jobs wait at a time. Input is limited to 1 MB and 18,000 frames. Files and the reusable bundle live in gitignored `out/`. Jobs are held in memory and reset on restart; this service is for the local single-user demo.

`pnpm check:render` checks queue recovery, HTTP validation, CORS and downloads without running Chromium. `pnpm check:render:smoke` bundles once and renders the complete sample in all three ratios, checking MP4 dimensions and duration. The smoke check requires a browser and network access for the sample's Google Fonts.

