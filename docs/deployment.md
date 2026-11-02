# Supported production deployment

Run one persistent Linux Node host, containing both the Next server and the loopback-only render worker. A mounted disk preserves workspaces, credits, usage budgets, receipts, research, and completed render status across restarts. Next handles MCP and browser SSE in the same process. This topology deliberately uses one replica; serverless deployments and horizontal scaling are refused/unsupported until a shared database and event bus replace the file stores.

```sh
docker build -t shipcast .
docker run --init --restart unless-stopped -p 3000:3000 \
  --env-file .env.production -e DATA_ROOT=/data \
  -v shipcast-data:/data shipcast
```

Set APP_ORIGIN to the public HTTPS origin. Put an HTTPS reverse proxy in front of port 3000. Forward Host and Origin consistently; disable proxy buffering on `/api/workspace/events`. Never expose port 3200. The launcher generates a private render key shared by its two child processes; an explicit RENDER_API_TOKEN of at least 24 characters can override it. Do not set VERCEL; this is not a serverless build.

Configure provider credentials on the host, plus BLOB_READ_WRITE_TOKEN for shareable screenshots and MP4s. Blob assets are public by design; local image downloads remain authenticated. Without Blob, export supports private downloads but completed renders cannot be selected for aggregator publishing. Social publishing still needs DISTRIBUTION_TOKEN and the destination/aggregator credentials. OAuth remains deferred.

Paid APIs require a workspace; the browser creates it automatically. Chat edits cost one credit. Atomic persistent quotas default to 100 paid attempts globally/day and 30/workspace/day, including MCP research. Failed calls still consume the safety quota, while failed AI operations refund workspace credits. Override AI_GLOBAL_DAILY_LIMIT, AI_WORKSPACE_DAILY_LIMIT, and WORKSPACE_DAILY_LIMIT (100 new/rotated workspace attempts/day). Render limits are 20/workspace/day and 100 globally/day. These are attempt caps, not monetary billing caps; also configure provider spending limits in the provider dashboard. Invalid requests fail before providers run. Never enable ALLOW_ANONYMOUS_AI in production (the code ignores it there).

Back up the volume and monitor disk usage. Interrupted renders become retryable error jobs on restart; completed jobs remain downloadable. In-flight publication attempts remain blocked until an operator checks the destination, preventing silent reposts. Do not delete receipts or quota files to recover disk space.

## Credential-dependent acceptance checks

1. Create a workspace in the deployed HTTPS browser, connect the real Codex CLI with its displayed command, and build one project. Observe the same timeline in Studio.
2. Generate one film using a product you control. Check facts, source URLs, image visibility, credit debit, and latency. Verify failure refunds without unlimited retries.
3. Export all three ratios. Restart the host and confirm completed downloads still work. Confirm render endpoints reject missing keys and foreign-workspace job IDs.
4. With Blob configured, open a completed public MP4 URL and select it in the publisher's Completed export field. Publish to a test destination you control and record the actual provider receipt. Retry the same request and verify no duplicate appears.
5. Verify a second workspace cannot read the first workspace's projects, local assets, or render jobs. Verify cross-origin writes and requests without a workspace are rejected.

These live checks need deployment access and real provider credentials. Automated checks use stub providers and cannot certify live account permissions, output quality, or production network access.
