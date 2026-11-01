# Product research

`research(url)` in `src/server/research.ts` turns a product URL into a sourced `researchBrief` (`src/lib/research-contracts.ts`). Every claim carries the URL of the page that states it.

## Pipeline

1. Exa calls, each with a 25 s timeout. The first three start together:
   - `POST /contents` on the product URL: `text` (8k chars, compact), `subpages: 5` with `subpageTarget` pricing/features/about/docs/changelog/blog, `extras.imageLinks: 6`. Required: if the site can't be read, research fails.
   - `POST /search` (`type: "auto"`, 10 results, last 2 years, `excludeDomains: [own domain]`, query-guided `highlights` of 500 chars) for third-party mentions.
   - `POST /findSimilar` (8 results, `excludeSourceDomain`, `excludeDomains`, highlights). Exa marks it deprecated but serves it; it finds directory listings of the product and look-alike sites.
   - `POST /search` with `category: "company"`, started as soon as `/contents` returns, with a query built from the site's own title and text ("Alternatives to ..."). This is Exa's documented replacement for findSimilar and finds real competitors.
   Only `/contents` is required; the searches degrade to empty lists.
2. Every returned URL must pass `publicUrl` (no private hosts or credentials); own-domain results are dropped; the rest become up to 24 deduped "candidates".
3. One `structured()` call (the cheap server model) writes product, features, proof and voice from the capped site text, and sorts the candidates: `mentionUrls` (pages about this exact product, not a different company with the same name) and `competitors` (another product's own site). Mention text, visuals and sources are copied from Exa, not written by the model.
4. Grounding: claims must cite a fetched own page or accepted mention; numbers in proof must appear in the cited source; quotes and `voice.sampleLines` must appear in it; competitors must be candidates that are not mentions. Anything else is dropped. In `/api/generate`, stat layers whose number the sources never state are removed too.
5. The brief is cached for 24 h per normalized URL (no `www.`, query or trailing slash) in `.data/research/` (`RESEARCH_DATA_DIR`), written atomically. Cache hits make no provider calls. Failures are never cached.

Cost per uncached run: about $0.02 of Exa (contents for up to 6 pages ~$0.002, two searches ~$0.007 each, findSimilar ~$0.004) plus one model call of roughly 8 to 12k input and 1 to 2k output tokens.

## Where it is used

- `POST /api/research` `{ url }` returns the brief (1 credit with a workspace cookie).
- `POST /api/generate` researches first (best effort; without `EXA_API_KEY` the film is written from the scraped page) and writes the film with an art-direction step: story angle, hook, the 3 strongest proof points and a visual concept, then the scenes. The response includes `research` when available.
- `POST /api/kit` adds the cached brief (for the film's CTA URL, else the workspace brief URL) so copy names real features, proof and voice. It never triggers new research.
- MCP: `research_product { url }` (1 workspace credit) and `get_brief`, which includes `research` once the brief URL has been researched.

`pnpm check:research` covers merging, exclusion, the SSRF guard, degradation, cache, grounding, the route and credits with stubbed Exa and model.
