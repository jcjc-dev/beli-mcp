import { BeliClient } from "@beli/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FileSessionStore } from "./auth.js";
import { loadConfig, type Config } from "./config.js";
import { AppContext } from "./context.js";
import { DraftStore } from "./drafts/store.js";
import { registerAllTools } from "./tools/index.js";

export interface BuiltServer {
  server: McpServer;
  ctx: AppContext;
  config: Config;
}

/** Wire up the client, session store, drafts and all tools. */
export async function buildServer(config: Config = loadConfig()): Promise<BuiltServer> {
  const client = new BeliClient({
    phone: config.phone,
    password: config.password,
    store: new FileSessionStore(config.sessionPath),
  });
  await client.init();

  const drafts = new DraftStore(config.draftsPath);
  const ctx = new AppContext(client, drafts, config);

  // Auto-login: when a tool needs auth and no valid session exists, transparently
  // launch the browser login popup (unless running headless). Skipped when creds
  // are provided (the client logs in headlessly via those instead).
  if (!config.noBrowser && !(config.phone && config.password)) {
    client.setOnAuthRequired(async () => {
      await ctx.interactiveLogin();
    });
  }

  const server = new McpServer({
    name: "beli-mcp",
    version: "0.2.0",
  });
  registerAllTools(server, ctx);

  return { server, ctx, config };
}
