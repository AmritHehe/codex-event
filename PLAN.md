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
- [x] B4.1 Bundle `src/video/index.ts` once at startup (`@remotion/bundler`), reuse for every job
- [x] B4.2 `POST /render` per `renderRequest` → validate (400 on failure) → `renderJob`
- [x] B4.3 `GET /render/:jobId` → `renderJob`; `GET /files/:jobId.mp4` serves the result from `out/` (gitignored)
- [x] B4.4 Composition `LaunchVideo`, inputProps `{ project }`; `selectComposition` reads size/length from `calculateMetadata` in `src/video/Root.tsx`
- [x] B4.5 One job at a time (in-memory queue is fine); CORS for `http://localhost:3000`. `node:http` or Hono. Pin `@remotion/bundler` + `@remotion/renderer` to the `remotion` version
- Done when: sample renders in 16:9, 9:16, 1:1 with Player-identical timing; bad JSON → 400; a crashed render → `status: "error"`, never hangs

**Frontend (us)**
- [x] F4.1 Export popover in Studio: formats → one job each → progress on a timeline track → download (uses `RENDER_URL`)

### Phase 5: Distribution kit
- [x] Distribution hub: 66 channels, 9 agents, automation level per channel (`/distribution`)
- [x] (backend) Copy agent: X thread, LinkedIn post, Product Hunt tagline, Reels/TikTok captions + hashtags
- [x] (frontend) Meme agent: trending templates as still compositions w/ product layers
- [x] (backend) Direct posting: X, Bluesky, Threads, Mastodon, Telegram (official APIs)
- [x] (backend) Aggregator for TikTok/YouTube/Pinterest/LinkedIn page (audited apps avoid private-only lock) + schedule
- [x] (backend) Community/launch agents: draft-only queues for Reddit, Product Hunt, HN prep (no auto-posting there)

Phase 5 implementation: the copy agent ships in the Phase 3 PR. The distribution PR adds the other workspace tools and adapters; social credentials are required for live posting. Scheduling runs through Ayrshare; community queues stay local and manual. See `docs/distribution.md`.

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

## Phase 10: Bring your own agent (the core bet)

Users connect the AI they already pay for (Claude Code, Codex CLI, Gemini CLI). Their agent connects to **our hosted MCP server** and builds the film with their subscription; the web app watches it happen live. We never touch subscription credentials (provider terms forbid proxying consumer plans): the user's CLI is always the client.

Contract: `src/lib/agent-contracts.ts` (MCP tool schemas, workspace API, live event stream). Agent instructions: `plugin/skills/shipcast-launch/SKILL.md` (single source; the MCP server also serves it as the `launch` prompt so Codex and Gemini get it too).

**Connect flow**
1. `/connect`: pick Claude Code / Codex / Gemini CLI, paste product URL (saved as the workspace brief).
2. Copy one command with the workspace token, e.g. `claude mcp add --transport http shipcast <origin>/mcp --header "Authorization: Bearer <token>"`.
3. Page flips to "Connected: Claude Code" on the agent's first MCP call.
4. User runs `/shipcast:launch` (plugin) or `/mcp__shipcast__launch` (MCP prompt). The agent calls `get_brief`, scrapes, `create_project`, then `put_scene` per scene: the Studio timeline fills live.
5. Free credits (`FREE_CREDITS`) cover server-side humanised copy for users with no agent. Memes come from agents with image tools (Codex, Gemini) via `save_asset`.
6. Posting via the Phase 5 publishers.

**Backend (us: Amrit + Claude, the MCP is the core of the demo)**
- [ ] B10.1 Workspace store: anonymous workspace + random token (hash at rest), httpOnly cookie for web. File store in dev (`.data/`), Upstash Redis via Vercel Marketplace for deploy
- [ ] B10.2 MCP server at `/mcp` (Streamable HTTP, `mcp-handler` + official SDK), Bearer token auth, tools exactly per `mcpTools`; `get_guide` returns `z.toJSONSchema(projectSchema)` + SKILL.md rules + `sampleProject`; record `clientInfo` as a connection
- [ ] B10.3 MCP prompt `launch` serving SKILL.md (so it shows up as a slash command in every client)
- [ ] B10.4 `GET /api/workspace/events` SSE per `agentEvent`; `GET /api/projects/:id`; `POST /api/workspace/brief`
- [ ] B10.5 Credits ledger: start at `FREE_CREDITS`, debit `/api/kit` (1 per channel) and `/api/generate`; 402 with a clear message when empty
- [ ] B10.6 Stretch: MCP OAuth (so "connect" is a browser approve screen instead of a token)
- [ ] B10.7 Verify install commands for Codex (`codex mcp add`) and Gemini (`gemini mcp add`) against current CLI docs

**Frontend (us)**
- [ ] F10.1 `/connect` onboarding: agent picker, URL brief, one-command copy, live connection state, "run /shipcast:launch" step
- [ ] F10.2 Live build in Studio: scenes stream onto the timeline as the agent writes them (activity feed of tool calls)
- [ ] F10.3 Credits UI: remaining credits, kit uses credits when no agent is connected
- [ ] F10.4 Landing: primary CTA becomes "Connect your Claude"; URL form stays as the no-agent path
- [x] F10.5 Claude Code plugin + marketplace (`plugin/`, `.claude-plugin/marketplace.json`): `/plugin marketplace add AmritHehe/codex-event`, `/plugin install shipcast@shipcast`

## Phase 11: Backend track for the collaborator (parallel to Phase 10)

Everything here is server-side and independent of the MCP work. Where a workspace is needed, code against the `WorkspaceStore` interface that lands with B10.1 (`src/server/workspace/store.ts`); until then use the workspace id from the cookie as an opaque string.

- [ ] B11.1 **Connect social accounts from the platform (OAuth).** Replace server env credentials with per-workspace connections: X (OAuth 2.0 PKCE), LinkedIn (Share on LinkedIn, `w_member_social`), Threads, Bluesky (app password form, or OAuth if available), Mastodon (per-instance app registration). Encrypt tokens at rest (`ENCRYPTION_KEY`, AES-GCM), refresh before expiry, disconnect endpoint. Publishers in `src/server/distribution/adapters.ts` read the workspace's tokens instead of `process.env`. API: `GET /api/accounts`, `GET /api/accounts/:provider/start`, `GET /api/accounts/:provider/callback`, `DELETE /api/accounts/:provider`. Frontend (us) builds the Connections UI against it; add the response schemas to a new `src/lib/accounts-contracts.ts` in the first PR.
- [ ] B11.2 **Asset storage on Vercel Blob** (via Vercel Marketplace / `vercel blob`). Copy Firecrawl screenshots on generate (their URLs expire), store `save_asset` memes, and upload finished renders so publishers get public HTTPS media URLs (TikTok, Shorts, Pinterest need them). One helper `putAsset(workspaceId, bytes, type) -> url`.
- [ ] B11.3 **Render to publish.** After a render job finishes, upload the MP4 to Blob (B11.2) and expose its URL on the job (`renderJob.url` becomes absolute). Then a "post this video" path: `POST /api/distribution/publish` accepts a `renderJobId` and resolves the media URL server-side.
- [ ] B11.4 **Scheduling for direct channels.** Direct publishers only post immediately today. Add scheduled posts with Vercel Cron (or Vercel Queues): store scheduled items per workspace, run due ones through the existing ledger so retries stay idempotent.
- [ ] B11.5 **Abuse protection.** Per-workspace and per-IP rate limits on `/api/generate`, `/api/kit`, `/api/edit` (credits spend money) and on `/mcp`. Vercel BotID on the public forms.
- [ ] B11.6 **Deploy.** Vercel project for the web app (+ env via `vercel env`), render server on a long-running host (Railway/Fly) or Remotion Lambda, `RENDER_ORIGINS`/`NEXT_PUBLIC_RENDER_URL` wired, smoke test script against the deployed URLs.

Order of value for the demo: B11.1 → B11.2 → B11.3, then the rest.
