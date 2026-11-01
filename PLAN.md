# Shipcast — build plan

> Building is solved. Distribution isn't. Shipcast turns a product URL into a launch video
> + a full content kit, editable layer-by-layer, posted everywhere.
> (Working name — rename anytime.)

## Core bet: video as code

Videos are **JSON → Remotion (React) compositions**, not AI pixels.
Every text, image, shape, screenshot = a layer with props. So:
- edit one word without regenerating
- chat edits = JSON patches
- one project → 9:16 / 1:1 / 16:9 re-renders for free
- variants (hooks, colors, CTAs) are cheap → A/B distribution loop

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | **Next.js 16** (App Router, TS, Tailwind v4) | your pick; route handlers = Node backend for light API |
| Video engine | **Remotion 4** | React-based video; same component renders in browser + server |
| Preview | `@remotion/player` | real-time in-editor preview, no render needed |
| Render | **Node render server** (`server/render.ts`, `@remotion/renderer`) | Chromium + ffmpeg + long jobs don't belong in Next request handlers |
| AI | **AI SDK 7 + Vercel AI Gateway** | model = string, swap Claude/GPT freely; structured output via zod |
| Scraping | **Firecrawl** (Vercel Marketplace) | URL → markdown + screenshot + brand colors in one call |
| Schema | **zod** | one schema validates AI output, editor, and render input |
| Posting | X API first, aggregator (Ayrshare/Postiz) for rest | TikTok/IG/LinkedIn app approval takes days |
| Persistence | localStorage until needed (Phase 6) | YAGNI — no DB for a single-user demo |

Run: `pnpm dev` (Next) + `pnpm render-server` (Node). Remotion Studio: `pnpm studio`.

## Phases (each bullet = one commit)

### Phase 0 — Foundation ✅
- [x] git init + Next.js scaffold
- [x] plan

### Phase 1 — Layered video engine (the core) ✅
- [x] Layer schema (zod): project → scenes → layers (text, image, shape, device-screenshot, logo, cta), theme, aspect
- [x] Remotion compositions render any project JSON; animations (fade/slide/pop/typewriter/zoom) per layer
- [x] "Launch" template: hook → problem → product screenshot → features → CTA
- [x] Aspect-ratio aware layout (9:16 / 1:1 / 16:9)
- [x] Player preview page in Next

### Phase 2 — Editor ✅
- [x] Editor shell: scenes list · player · inspector
- [x] Layer panel: select, reorder, hide, delete, add layer
- [x] Inspector: edit text, colors, fonts, timing, animation
- [x] Timeline: scene durations, scrub, click-to-seek
- [x] Theme panel (brand colors/fonts) + aspect switcher
- [x] Undo/redo + autosave to localStorage

## Two tracks, worked in parallel

| | Backend track: collaborator | Frontend track: Amrit + Claude |
|---|---|---|
| Owns | `server/`, `src/app/api/`, `src/server/` | `src/app/page.tsx`, `src/app/(app)/`, `src/landing/`, `src/editor/`, `src/distribution/`, `src/components/` |
| Shared, change only in a small separate PR | `src/lib/contracts.ts`, `src/video/schema.ts`, `src/app/globals.css` tokens | same |
| Flow | branch `feat/<thing>` → PR → review → merge | same |

The contract in `src/lib/contracts.ts` (zod schemas + `postJson`) is the handshake: the frontend calls these endpoints and shows real loading/error states; the backend makes them work. Nobody waits on anybody.

### Phase 3: AI generation
**Backend (collaborator)**
- [x] B3.1 Firecrawl via Vercel Marketplace (`vercel integration add firecrawl`): URL → markdown, screenshot, brand colors, logo (`src/server/scrape.ts`)
- [x] B3.2 `POST /api/generate` per `generateRequest`/`generateResponse`: scrape → AI SDK structured output (`projectSchema`) via AI Gateway → validated project. Use the scraped screenshot URL in the image layer
- [x] B3.3 `POST /api/edit` per `editRequest`/`editResponse`: instruction + project → new project + one-line summary. Must keep ids of untouched layers stable
- [x] B3.4 `POST /api/kit` per `kitRequest`/`kitResponse`: per-channel copy (X thread, LinkedIn, Product Hunt tagline, captions)

**Frontend (us)**
- [x] F3.1 Landing + Studio "paste your URL" entry with generating state (timeline-style progress)
- [x] F3.2 Studio chat-edit bar: instruction → `/api/edit` → undoable update, summary toast
- [x] F3.3 Kit panel in Distribution: pick channels → `/api/kit` → editable drafts with copy buttons

Phase 3 implementation is complete. Provider calls require the server keys in `.env.example`; automated API and browser checks use provider fixtures. See README for setup and manual verification.

### Phase 4: Render & export
**Backend (collaborator)**: render server (`server/render.ts`, `pnpm render-server`, port 3200)
- [ ] B4.1 Bundle `src/video/index.ts` once at startup (`@remotion/bundler`), reuse for every job
- [ ] B4.2 `POST /render` per `renderRequest` → validate (400 on failure) → `renderJob`
- [ ] B4.3 `GET /render/:jobId` → `renderJob`; `GET /files/:jobId.mp4` serves the result from `out/` (gitignored)
- [ ] B4.4 Composition `LaunchVideo`, inputProps `{ project }`; `selectComposition` reads size/length from `calculateMetadata` in `src/video/Root.tsx`
- [ ] B4.5 One job at a time (in-memory queue is fine); CORS for `http://localhost:3000`. `node:http` or Hono. Pin `@remotion/bundler` + `@remotion/renderer` to the `remotion` version
- Done when: sample renders in 16:9, 9:16, 1:1 with Player-identical timing; bad JSON → 400; a crashed render → `status: "error"`, never hangs

**Frontend (us)**
- [ ] F4.1 Export popover in Studio: formats → one job each → progress on a timeline track → download (uses `RENDER_URL`)

### Phase 5: Distribution kit
- [x] Distribution hub: 66 channels, 9 agents, automation level per channel (`/distribution`)
- [ ] (backend) Copy agent: X thread, LinkedIn post, Product Hunt tagline, Reels/TikTok captions + hashtags
- [ ] (frontend) Meme agent: trending templates as still compositions w/ product layers
- [ ] (backend) Direct posting: X, Bluesky, Threads, Mastodon, Telegram (official APIs)
- [ ] (backend) Aggregator for TikTok/YouTube/Pinterest/LinkedIn page (audited apps avoid private-only lock) + schedule
- [ ] (backend) Community/launch agents: draft-only queues for Reddit, Product Hunt, HN prep (no auto-posting there)

#### Distribution research (2026-11-01, re-check before relying on it)
- **Auto-post via official API:** X ($0.015/post, $0.20 with URL), LinkedIn profile, Instagram (own Business/Creator acct), Threads, Bluesky, Mastodon, Facebook page, Telegram, Discord (own server).
- **Needs audit/review → use aggregator:** TikTok + YouTube (unaudited = private only), Pinterest (trial = sandbox), LinkedIn company page.
- **Draft-only (no API or ToS forbids):** Reddit (new API access closed Oct 31 2026, public API shutting down by Mar 2027), Product Hunt, groups, Slack communities, DMs.
- **Manual:** Hacker News bans AI-written/edited comments; agent only preps + monitors.
- **Aggregators:** Zernio (ex-Late; 2 accounts free, then $6/acct), Upload-Post ($24/mo, 22 networks incl. TikTok), Postiz ($29/mo or self-host), Ayrshare ($149/mo).
- **Agent stores = distribution to AI agents:** official MCP Registry → Smithery/Glama/PulseMCP, ChatGPT apps directory, Claude connectors + Claude Code plugins, Agent Skills (skills.sh), Cursor Marketplace, Google Connected Apps (preview), x402 Bazaar. Phase 7 ships Shipcast's own MCP server into these.

### Phase 6 — Variant engine (moat)
- [ ] Generate N variants (hook / palette / CTA) from one project
- [ ] Variant grid + batch render
- [ ] Persist projects + post metrics (DB via Vercel Marketplace)
- [ ] "Double down": regenerate from best-performing variant

### Phase 7 — Ship → announce from IDE
- [ ] MCP server: `create_launch(url | repo)` tool → project link + MP4
- [ ] GitHub release/changelog → "what's new" video

### Phase 8 — Demo polish
- [x] Landing page + pitch (live engine hero, bento, channels, agents)
- [ ] Deploy web to Vercel; render server local/remote
- [ ] Demo script: judge's URL → video in 60s → chat edit → post live

### Phase 9: Frontend redesign to DESIGN.md (frontend track)
- [ ] Landing: timeline-as-page concept, scroll playhead HUD
- [ ] Studio: pro editing-tool chrome (tracks, timecode, hairlines)
- [ ] Distribution: editorial index of channels and agents
