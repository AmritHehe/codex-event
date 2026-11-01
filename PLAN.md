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

### Phase 3 — AI generation
- [ ] Firecrawl integration: URL → content + screenshot + brand
- [ ] `POST /api/generate`: scraped data → project JSON (structured output, zod-validated)
- [ ] Chat edit: "make hook punchier, dark theme" → patched project JSON
- [ ] Landing input: paste URL → land in editor with generated video

### Phase 4 — Render & export
- [ ] Node render server: bundle once, `renderMedia` jobs, progress
- [ ] Export UI: pick aspects → MP4s, progress bar, download
- [ ] `renderStill` → thumbnails / static posts

### Phase 5 — Distribution kit
- [x] Distribution hub: 66 channels, 9 agents, automation level per channel (`/distribution`)
- [ ] Copy agent: X thread, LinkedIn post, Product Hunt tagline, Reels/TikTok captions + hashtags
- [ ] Meme agent: trending templates as still compositions w/ product layers
- [ ] Direct posting: X, Bluesky, Threads, Mastodon, Telegram (official APIs)
- [ ] Aggregator for TikTok/YouTube/Pinterest/LinkedIn page (audited apps avoid private-only lock) + schedule
- [ ] Community/launch agents: draft-only queues for Reddit, Product Hunt, HN prep (no auto-posting there)

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
- [ ] Landing page + pitch
- [ ] Deploy web to Vercel; render server local/remote
- [ ] Demo script: judge's URL → video in 60s → chat edit → post live
