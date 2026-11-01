# Shipcast design system

Read this before touching any UI. Every surface (landing, Studio, Distribution) must look like one product.

## Idea: the interface is a video timeline

Shipcast makes video as code. The UI borrows the language of professional editing tools (timecode, tracks, playheads, frame counts, rulers) and sets it in a sharp, editorial light theme. Think Linear's precision crossed with a broadcast control room, printed on paper.

- **Motif 1: timecode.** Monospace labels like `00:00:04:12`, `SCN 03`, `1920 × 1080`, `29.97 fps` used as real metadata, never decoration without meaning.
- **Motif 2: tracks and playheads.** Thin horizontal lanes, a 1px accent playhead, tick rulers. Used where something actually has a position in time or progress.
- **Motif 3: hairlines over shadows.** Structure comes from 1px rules (`border-line`), not cards with drop shadows.

## Tokens (`src/app/globals.css`, do not edit in feature branches)

| Token | Use |
|---|---|
| `canvas` #f4f4f2 | page background |
| `panel` #fbfbfa | raised surfaces |
| `ink` #111111 | text, primary buttons |
| `muted` #66666b | secondary text (AA on canvas) |
| `faint` #a3a3a8 | tertiary, disabled only |
| `line` #e2e2df | hairlines |
| `accent` #2f54eb | signal cobalt: playhead, live state, one highlight per view |
| `accent-soft` #edf1ff | selected backgrounds |

One accent. No gradients on UI chrome. No purple. The video content has its own themes; the UI never does.

## Type

- **Geist** (`font-sans`) for everything, **Geist Mono** (`font-mono`) for timecode, numbers, labels.
- Display: Geist 600, tracking `-0.05em` to `-0.06em`, line-height 0.9 to 0.95. Go big: hero `clamp(56px, 10vw, 168px)`, section titles `clamp(40px, 6vw, 96px)`.
- Labels: Geist Mono 11 to 12px, uppercase, tracking `0.08em`, `text-muted`. Max one label per section heading.
- Body 15 to 18px, line-height 1.55, max 60ch.
- `font-display` (Bricolage) is reserved for the video engine. Do not use it in UI.

## Shape

- Controls 6px radius, panels and media frames 10px, pills only for status chips. No `rounded-full` buttons except icon-only circles.
- Shadows only on floating layers (menus, popovers, the dragged item): `shadow-pop`.

## Motion

- Ease out `cubic-bezier(0.16, 1, 0.3, 1)` for entrances (600 to 1000ms), `cubic-bezier(0.23, 1, 0.32, 1)` for UI (150 to 250ms). Never linear except progress and marquees.
- Press feedback: `.press` class (scale 0.97).
- No animation on keyboard-triggered actions. Respect `prefers-reduced-motion` everywhere (motion collapses to the end state).
- Motion library: `motion/react`. Animate `transform`, `opacity`, `clip-path` only.
- Max one signature effect per viewport.

## Copy

- No em dashes or en dashes anywhere visible. Plain, concrete verbs. No "seamless", "elevate", "unleash".
- Numbers come from data (`CHANNELS.length`, `AGENTS.length`), never invented.

## Icons

Phosphor only (`@phosphor-icons/react`, `/ssr` in server components), weight `regular` in chrome, `fill` for brand marks. Shared channel/agent icons live in `src/distribution/icons.tsx`.

## Don'ts

Card grids with shadows, centered hero + two buttons + mockup, emoji, decorative status dots, fake screenshots built from divs, more than 3 simultaneous effects, pure `#000`/`#fff` large surfaces.
