# Distribution workspace (Phase 5)

Open `/distribution` and use the **Launch workspace** tabs:

- **Publish:** review a draft, check your connections, then explicitly publish or schedule it. Official adapters support immediate **text** posts to X, Bluesky, Threads, Mastodon, and Telegram. Ayrshare handles media and scheduling for TikTok, YouTube Shorts, Pinterest, and a connected LinkedIn page. Media must have a public HTTPS URL; localhost render downloads must be uploaded to your own host first. YouTube needs a title and defaults to private visibility; Pinterest needs a board ID.
- **Meme:** load Imgflip's current popular templates, edit two caption layers, and export a 1080×1080 PNG with the saved project's name/accent. Templates reflect Imgflip's popularity feed, not a claim about global trends. Captioning/export happens locally; project text is not sent to Imgflip.
- **Community:** keep editable Reddit, Product Hunt, and HN preparation drafts in localStorage with draft/ready/manually-submitted states. HN entries start blank. These channels are excluded from the publishing API.

The copy agent is supplied by Phase 3 (`POST /api/kit` in its separate PR). This PR adds the remaining distribution surfaces on current main without duplicating that API.

Add the settings from `src/server/distribution/credentials.env.example` to `.env.local`, configure the desired server credentials, set a random `DISTRIBUTION_TOKEN` of at least 24 characters, and restart Next. Enter that workspace key in the Publish tab and click **Check connections**. The key stays in memory; social credentials never enter browser responses. Posting stays disabled without it. The API accepts one reviewed destination at a time and never retries an upstream POST automatically.

`POST /api/distribution/publish` uses `src/lib/distribution-contracts.ts`; `GET /api/distribution/connections` returns configured flags after authentication. Every publication has a request UUID. A persistent, locked, atomically-written ledger under `.data/distribution` prevents duplicate sends on concurrent requests, retries and server restarts. Completed requests return their saved receipt. Interrupted/uncertain attempts return 409, so check the destination before creating a new request. Aggregator acceptance is shown as **submitted**, not confirmed delivery; verify asynchronous delivery in its dashboard. Scheduling is performed by Ayrshare, with browser-local times converted to UTC and past/near-past times rejected.

Keep `DISTRIBUTION_DATA_DIR` on persistent writable storage. A single shared filesystem is required for multiple Node processes; serverless deployments need a durable database before enabling posting. Community drafts remain local to the browser. The integration uses configured single-user accounts, without an OAuth account-connection UI.

`pnpm check:distribution` validates all nine adapter payloads with mocked HTTP, authentication, channel restrictions, scheduling rules, persisted idempotency, interrupted requests, and safe meme composition. No social posts are made by the checks. Live social verification requires your configured accounts.

API references: [X](https://docs.x.com/x-api/posts/create-post), [Bluesky](https://bsky.network/docs/advanced-guides/posts/), [Threads](https://www.postman.com/meta/threads/collection/dht3nzz/threads-api), [Mastodon](https://docs.joinmastodon.org/methods/statuses/), [Telegram](https://core.telegram.org/bots/api#sendmessage), [Ayrshare](https://www.ayrshare.com/docs/apis/post/post), and [Imgflip](https://imgflip.com/api).

