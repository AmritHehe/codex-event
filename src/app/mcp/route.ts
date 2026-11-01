import { mcpRoute } from "@/server/mcp/server";

// Public path MCP_PATH ("/mcp"). Stateless Streamable HTTP: POST carries JSON-RPC, GET/DELETE answer 405.
export const maxDuration = 60;
const handler = mcpRoute();
export { handler as GET, handler as POST, handler as DELETE };
