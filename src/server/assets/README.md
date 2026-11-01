# Persistent launch assets (B11.2–B11.3)

Configure `BLOB_READ_WRITE_TOKEN` on Next and the render service. Screenshot generation copies Firecrawl images to public Blob storage when configured. Set `SCREENSHOT_ASSET_HOSTS` to the exact trusted storage host returned by Firecrawl if it differs from the defaults. Without Blob, the existing local demo still works with temporary screenshot URLs and local MP4 downloads.

`putAsset(workspaceId, bytes, type) -> url` is the reusable upload boundary for Phase 10's future `save_asset` tool. Public URLs have random names under hashed workspace prefixes. The existing single-operator APIs use the `anonymous`/`operator` namespaces until B10.1 provides authenticated workspace identities. This PR does not add OAuth or claim per-workspace authorization.

`POST /api/assets` accepts `{ dataUrl }` for PNG/JPEG up to 2 MB, authenticated with the existing `DISTRIBUTION_TOKEN`. Credentials are not returned. Finished renders upload MP4s (100 MB limit) before a job becomes done; `renderJob.url` becomes the absolute Blob URL. Otherwise jobs retain their local download URL.

For render-to-publish, configure server-only `RENDER_SERVICE_URL`, then send `{ requestId, channel, text, renderJobId, ...channelOptions }` to the existing authenticated `/api/distribution/publish`. It resolves a completed job server-side and refuses unfinished or local-only media. Supply either `renderJobId` or `mediaUrl`. Only aggregator destinations accept render media. The existing publication ledger remains idempotent against the original request, including retries after the render service restarts.

Deployment is not part of this PR: the render service must remain on loopback or a private trusted network. Its existing endpoints are not a public multi-user authorization boundary. Live Blob verification requires a configured storage token. OAuth, direct scheduling, abuse protection, and production deployment remain unchecked in PLAN.md.
