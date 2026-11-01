---
name: shipcast-launch
description: Build an editable launch film and launch copy for a product with Shipcast. Use when the user asks to make a launch video, promo, product film, launch kit, or runs /shipcast:launch. Requires the shipcast MCP server.
---

# Build a Shipcast launch film

You are building a launch film for the user's product. The film is JSON (scenes of layers), rendered by Shipcast's video engine and edited layer by layer in the Shipcast Studio. The user is watching the Studio while you work: every `put_scene` call appears on their timeline live. Work scene by scene, never in one giant call.

## Workflow

1. **Brief.** Call `shipcast.get_brief`. It returns the product URL (and optional notes) the user entered on Shipcast. If it is empty, ask the user for their product URL.
2. **Schema.** Call `shipcast.get_guide` once. It returns the exact JSON Schema and an example. Follow it exactly; it wins over anything in this file.
3. **Research the product.** Fetch the URL and at most 2 more pages that matter (pricing, features, docs home). Extract:
   - product name, one-line value proposition, the problem it removes, 3 to 4 concrete features
   - the main call to action and its URL
   - brand colors (`<meta name="theme-color">`, CSS variables, logo colors) and fonts if obvious
   - a real product image: `og:image`, a hero screenshot, or a product shot URL (https)
   - numbers ONLY if the site states them (users, stars, speed). Never invent metrics, quotes, logos or prices.
4. **Create.** `shipcast.create_project` with the name, URL, `aspect: "16:9"` and a theme built from the brand (see Theme). Tell the user the Studio URL it returns.
5. **Scenes.** `shipcast.put_scene` once per scene, in order:
   1. **Hook** (60 to 75 frames): badge + a 3 to 6 word headline that names the pain or the payoff.
   2. **Problem** (60 to 90): kicker + headline stating the problem in the customer's words.
   3. **Product** (90 to 120, `layout: "split"`): kicker with the product name, headline with the core promise, short body, and the product image with `frame: "browser"` (or `"phone"` for mobile apps) and `kenBurns: true`.
   4. **Features** (90 to 110): headline + `list` layer with 3 to 4 items, each under 6 words.
   5. **Proof** (60 to 75, optional): one `stat` layer, only with a real number from the site.
   6. **CTA** (75 to 90): headline + `cta` layer with the real call to action and `url` set to the product domain.
   If a call returns a validation error, fix exactly what it names and call again.
6. **Finish.** `shipcast.finish_project`, then tell the user the film is ready and they can edit any layer in the Studio.
7. **Copy (if the user wants a launch kit).** Write drafts and save them with `shipcast.draft_posts`: an X thread (`x`), a LinkedIn post (`linkedin-personal`), a Product Hunt tagline (`product-hunt`). Follow Copy rules.
8. **Memes (only if you can generate images).** Make 1 to 2 memes about the problem the product solves, then `shipcast.save_asset` with `kind: "meme"`. Skip this step if you have no image tool.

## Writing the film

- 30 fps. Total length 12 to 20 seconds. Scene `durationInFrames` between 60 and 120.
- One idea per scene. Headlines of at most 7 words. Body text at most 12 words.
- Highlight exactly one word per headline with asterisks: `"Ship it *loud*"`.
- Layer order inside a scene is the reading order; entrances stagger automatically, so leave `delay` unset unless needed.
- Transitions: first scene `"none"`, then vary between `"push"`, `"wipe"`, `"slide"`, `"fade"`. Don't repeat the same one twice in a row.
- Backgrounds: alternate `"mesh"` and `"grid"`/`"gradient"`; use `"solid"` for the stat scene.
- Layer and scene ids: short, unique, stable (`hook`, `h1`, `h2`...). Keep ids unchanged when you update a scene.

## Theme

- `background`, `surface`, `text`, `muted`: build a light or dark base that matches the brand site.
- `accent`: the brand's main color. It must be readable on `background` (contrast at least 3:1 for large text).
- `accent2`: a softer second brand color, used only in background blobs.
- Fonts (pick from the schema's enum): `headingFont` with character (Bricolage Grotesque, Space Grotesk, Sora, Syne), `bodyFont` neutral (Inter, DM Sans). Developer tools may use JetBrains Mono for both.

## Copy rules (humanised)

- Write like the founder talking to a friend: first person, specific, a little informal. No hype words (revolutionary, game-changing, unleash, seamless, elevate), no emoji walls, no em dashes.
- Lead with the problem or a concrete moment, then what the product does, then one clear ask.
- X thread: 3 to 5 posts separated by blank lines, each under 280 characters, link only in the last post.
- LinkedIn: hook line, 3 short paragraphs, ask at the end, under 200 words.
- Product Hunt tagline: under 60 characters, descriptive, no superlatives.
- Never claim anything was published. These are drafts the user reviews.
