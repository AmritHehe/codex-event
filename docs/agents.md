# Bring your own agent (Phase 10)

Your CLI agent (Claude Code, Codex CLI or Gemini CLI) connects to Shipcast's MCP server and builds the launch film with your own subscription. The Studio watches it happen live. Shipcast never sees your subscription credentials: your CLI is always the client.

## 1. Get a workspace token

Open `/connect` (or `POST /api/workspace`). It creates an anonymous workspace, sets an httpOnly cookie for the web app and shows the token **once**. Posting to `/api/workspace` again from the same browser keeps the workspace (brief, projects, credits) and issues a new token; the old token stops working.

Below, `<origin>` is the Shipcast URL (for example `http://localhost:3000`) and `<token>` is the workspace token.

## 2. Add the MCP server

**Claude Code:**

```sh
claude mcp add --transport http shipcast <origin>/mcp --header "Authorization: Bearer <token>"
```

Optional: install the plugin for the `/shipcast:launch` command and skill: `/plugin marketplace add AmritHehe/codex-event`, then `/plugin install shipcast@shipcast`.

**Codex CLI** (verified with `codex mcp add --help`, codex-cli 0.166.0). Codex reads the bearer token from an environment variable, so it must be set in the shell that runs `codex`:

```sh
export SHIPCAST_TOKEN=<token>   # add to your shell profile to keep it
codex mcp add shipcast --url <origin>/mcp --bearer-token-env-var SHIPCAST_TOKEN
```

**Gemini CLI** (verified with `gemini mcp add --help`, gemini-cli 0.66.0). `--scope user` makes it available outside the current project:

```sh
gemini mcp add --transport http --scope user shipcast <origin>/mcp --header "Authorization: Bearer <token>"
```

The `/connect` page flips to "Connected" on the agent's first MCP request (the server records the client name and version it reports).

## 3. Build the film

Ask the agent to run the `launch` prompt:

- Claude Code: `/shipcast:launch` (plugin) or `/mcp__shipcast__launch` (MCP prompt)
- Codex and Gemini CLI: run the `launch` prompt from the `shipcast` server (Gemini CLI exposes MCP prompts as slash commands, so `/launch`; not verified for Codex), or just say "build a Shipcast launch film".

The agent calls `get_brief`, `get_guide`, researches the product, then `create_project` and one `put_scene` per scene. Each call shows up on the Studio timeline (`/studio?live=<projectId>`). It ends with `finish_project`, optionally `draft_posts` (copy drafts, never published) and `save_asset` (memes, if it can generate images).

## Server reference

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `POST /mcp` | `Authorization: Bearer <token>` | Streamable HTTP MCP (stateless; 2025-era and 2026-07-28 clients). Tools exactly per `mcpTools` in `src/lib/agent-contracts.ts`, prompt `launch` = `plugin/skills/shipcast-launch/SKILL.md`. |
| `POST /api/workspace` | none / cookie | Create workspace (201) or rotate the token of the cookie's workspace (200). Sets the `shipcast_ws` cookie. |
| `GET /api/workspace` | cookie | Credits, connections, brief, project summaries. |
| `POST /api/workspace/brief` | cookie | `{ url, notes? }` read by `get_brief`. |
| `GET /api/projects/:id` | cookie | Project being built, only for its own workspace. |
| `GET /api/workspace/events` | cookie | Server-Sent Events, one `agentEvent` JSON per `data:` line, `: ping` every 15 s. |

**Credits.** New workspaces get `FREE_CREDITS` (20) for server-paid AI. With a workspace cookie, `/api/kit` costs 1 per channel, `/api/generate` costs 2 and `/api/research` costs 1, reserved up front and refunded if the call fails; `402` when the balance is too low. Requests without a workspace cookie are rejected; the browser establishes a workspace automatically. Chat edits cost 1 credit. Global and workspace daily attempt caps also apply; see docs/deployment.md. Agent (MCP) calls are free except `research_product` (1 credit, server-paid Exa research; see `docs/research.md`).

**Storage.** Workspaces live in `.data/workspaces/<id>/workspace.json` (override with `WORKSPACE_DATA_DIR`), written under a per-workspace lock with atomic rename; uploaded images in `assets/`. Tokens are stored only as SHA-256 hashes.

**Limits.** Live events use in-memory pub/sub, so SSE only sees MCP calls handled by the same server instance, and the file store needs one persistent filesystem. Both sit behind the `WorkspaceStore` interface (`src/server/workspace/store.ts`) so a Redis implementation can replace them for multi-instance deploys.

`pnpm check:agents` drives the real route handlers over HTTP with the official MCP SDK client, end to end.
