---
name: shipcast-launch
description: Build an editable launch film and launch copy for a product with Shipcast. Use when the user asks to make a launch video, promo, product film, launch kit, or runs /shipcast:launch. Requires the shipcast MCP server.
---

# Build a Shipcast launch film

You are building a launch film for the user's product. The film is JSON (scenes of layers), rendered by Shipcast's video engine and edited layer by layer in the Shipcast Studio. The user is watching the Studio while you work: every `put_scene` call appears on their timeline live. Work scene by scene, never in one giant call.

## Workflow

1. **Brief.** Call `shipcast.get_brief`. It returns the product URL (and optional notes) the user entered on Shipcast. If it is empty, ask the user for their product URL.
2. **Schema.** Call `shipcast.get_guide` once. It returns the exact JSON Schema and an example. Follow it exactly; it wins over anything in this file.
3. **Research the product.** If `get_brief` already returned `research`, use it. Otherwise call `shipcast.research_product` with the URL first (1 credit). Its brief is your source of truth: product, features, proof, competitors, third-party mentions, voice and visuals, each with a `sourceUrl`. Then fetch the URL yourself only for what the brief lacks:
   - the main call to action and its URL
   - brand colors (`<meta name="theme-color">`, CSS variables, logo colors) and fonts if obvious
   - a real product image: a brief `visuals` entry, `og:image`, a hero screenshot, or a product shot URL (https)
   Every fact in the film and copy must come from the brief or the pages you read. Use `proof` and `mentions` for proof, reuse `voice.sampleLines`, and never invent metrics, quotes, customers, logos or prices beyond them.
4. **Direct before you build.** Answer in one line each: who buys this and the one question they ask; the product's native surface (what its output looks like: a notification, a feed, a dashboard, a terminal); **the one thread** the viewer follows start to end (an object, a number, a person); where **the turn** is (old way ends, new way lands). Write the concept as one sentence. If it needs two, it's two films.
5. **Create.** `shipcast.create_project` with the name, URL, `aspect: "16:9"` and a theme built from the brand (see Theme). Tell the user the Studio URL it returns.
6. **Scenes.** `shipcast.put_scene` once per scene, in order. The shape (adapt it to your concept, never pad it):
   1. **Hook** (75 to 105 frames): the pain, in the first second. Show it, don't list it: `windows` (a cluttered desktop), a `peek` nobody answers, a `counter` ticking up. Headline 3 to 6 words.
   2. **Problem** (60 to 90): the thread gets worse (the counter keeps climbing, the same object, a sharper line).
   3. **The turn** (90 to 120): the product name once, on the moment the old way ends. Demonstrate it on its native surface: a `peek` with `press: true` (the human approves), the thread resolving (`counter` with `doneLabel`), or the product image (`layout: "split"`, `frame: "browser"`/`"phone"`, `kenBurns: true`).
   4. **The rest of the product** (75 to 100): 3 to 4 features as `list` with `variant: "chips"` (short noun phrases) or `"checks"`.
   5. **Proof** (60 to 75, optional): only numbers from the brief's `proof` (or a `mentions` source), as a `stat` or proof chips.
   6. **CTA** (75 to 90): callback to the hook (the same object, resolved) + headline + `cta` with the real call to action and `url` set to the product domain.
   If a call returns a validation error, fix exactly what it names and call again.
7. **Finish.** `shipcast.finish_project`, then tell the user the film is ready and they can edit any layer in the Studio.
8. **Copy (if the user wants a launch kit).** Write drafts and save them with `shipcast.draft_posts`: an X thread (`x`), a LinkedIn post (`linkedin-personal`), a Product Hunt tagline (`product-hunt`). Follow Copy rules.
9. **Memes (only if you can generate images).** Make 1 to 2 memes about the problem the product solves, then `shipcast.save_asset` with `kind: "meme"`. Skip this step if you have no image tool.

## Writing the film

- 30 fps. Total length 15 to 25 seconds. Scene `durationInFrames` between 60 and 120.
- **Carry a thread, don't list features.** The object from one scene opens the next (the same counter, the same peek, the same window). A film of five unrelated demos reads as a slideshow.
- **Flow never stops.** The engine already breathes the camera on every scene and lands headlines word by word; you keep it alive by giving every scene a second moving layer (a counter, chips, windows, a peek) beside its headline.
- One idea per scene. Headlines of at most 7 words. Body text at most 12 words.
- Highlight exactly one word per headline with asterisks: `"Ship it *loud*"`.
- Layer order inside a scene is the reading order; entrances stagger automatically, so leave `delay` unset unless needed.
- Transitions are handoffs: first scene `"none"`; then `"whip"` between beats of the same idea, `"zoom"` to push *into* the next thing (into the product, into the detail), `"ring"` for the reveal or the turn, `"fade"` only into the CTA. `push`, `wipe` and `slide` still work but read flatter. Don't repeat one twice in a row.
- Headlines enter word by word by default (`enter: "words"`); leave `enter` unset unless a layer needs something else.
- Layers: `windows` fills the frame behind everything else (put it first); `peek` drops from the top edge (`anchor: "notch"` springs it out of a MacBook notch, only for Mac apps); `counter` is a mono pill ticking `from` to `to` (seconds by default), and with `doneLabel` it stops mid-scene and flips to a checked state; `peek.press` presses the first button mid-scene, so pair it with a `counter` + `doneLabel` in the same scene for a satisfying stop.
- Backgrounds: alternate `"mesh"` and `"grid"`/`"gradient"`; use `"solid"` for the stat scene.
- Layer and scene ids: short, unique, stable (`hook`, `h1`, `h2`...). Keep ids unchanged when you update a scene.

## Theme

- `background`, `surface`, `text`, `muted`: build a light or dark base that matches the brand site. Light grounds read more premium in motion; prefer light unless the brand is unmistakably dark.
- `accent`: the brand's main color. It must be readable on `background` (contrast at least 3:1 for large text).
- `accent2`: a softer second brand color, used only in background blobs.
- Fonts (pick from the schema's enum): `headingFont` with character (Bricolage Grotesque, Space Grotesk, Sora, Syne), `bodyFont` neutral (Inter, DM Sans). Developer tools may use JetBrains Mono for both. Geist / Geist Mono suit clean product brands. Counters always render in Geist Mono.

## Copy rules (humanised)

- Write like the founder talking to a friend: first person, specific, a little informal. No hype words (revolutionary, game-changing, unleash, seamless, elevate), no emoji walls, no em dashes.
- Lead with the problem or a concrete moment, then what the product does, then one clear ask.
- X thread: 3 to 5 posts separated by blank lines, each under 280 characters, link only in the last post.
- LinkedIn: hook line, 3 short paragraphs, ask at the end, under 200 words.
- Product Hunt tagline: under 60 characters, descriptive, no superlatives.
- Never claim anything was published. These are drafts the user reviews.
