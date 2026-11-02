# Persistent launch assets (B11.2–B11.3)

Configure `BLOB_READ_WRITE_TOKEN` on Next and the render service. Screenshot generation copies Firecrawl images to public Blob storage when configured. Set `SCREENSHOT_ASSET_HOSTS` to the exact trusted storage host returned by Firecrawl if it differs from the defaults. Without Blob, the existing local demo still works with temporary screenshot URLs and local MP4 downloads.

`putAsset(workspaceId, bytes, type) -> url` is the reusable upload boundary used by MCP `save_asset` when Blob is configured. Public URLs have random names under hashed workspace prefixes. Generation, MCP assets, and browser renders use the authenticated workspace namespace. Direct operator uploads can still use the operator namespace. Local assets are served only to their owning workspace. OAuth remains deferred.

`POST /api/assets` accepts `{ dataUrl }` for PNG/JPEG up to 2 MB, authenticated with the existing `DISTRIBUTION_TOKEN`. Credentials are not returned. Finished renders upload MP4s (100 MB limit) before a job becomes done; `renderJob.url` becomes the absolute Blob URL. Otherwise jobs retain their local download URL.

For render-to-publish, configure server-only `RENDER_SERVICE_URL`, then send `{ requestId, channel, text, renderJobId, ...channelOptions }` to the existing authenticated `/api/distribution/publish`. The form also offers a Completed export selector. Render-ID publication requires a workspace cookie and an owned render, in addition to the publishing key. It resolves a completed job server-side and refuses unfinished or local-only media. Supply either `renderJobId` or `mediaUrl`. Only aggregator destinations accept render media. The existing publication ledger remains idempotent against the original request, including retries after the render service restarts.

See docs/deployment.md for the supported persistent single-host deployment. Browser exports use authenticated same-origin render routes and workspace ownership. Render HTTP requires a private key in production. Live Blob verification requires a configured storage token. OAuth and direct scheduling remain deferred.
