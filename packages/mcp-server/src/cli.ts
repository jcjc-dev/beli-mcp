#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BeliClient } from "@beli/client";
import { FileSessionStore } from "./auth.js";
import { loadConfig } from "./config.js";
import { runInteractiveLogin } from "./login/server.js";
import { buildServer } from "./server.js";

/**
 * `beli-mcp`            -> start the stdio MCP server (uses the saved session).
 * `beli-mcp login`      -> open a localhost browser login, validate credentials
 *                          against Beli, and persist the session, then exit.
 *                          If BELI_PHONE/BELI_PASSWORD are set, logs in headless
 *                          (useful for CI) without opening a browser.
 * `beli-mcp logout`     -> clear the saved session.
 * `beli-mcp whoami`     -> print the authenticated user id from the saved session.
 */
async function main(): Promise<void> {
  const cmd = process.argv[2];
  const config = loadConfig();

  if (cmd === "login") {
    if (config.phone && config.password) {
      const client = new BeliClient({
        phone: config.phone,
        password: config.password,
        store: new FileSessionStore(config.sessionPath),
      });
      await client.init();
      await client.login();
      process.stderr.write(
        `logged in as ${client.userId} (headless); session saved to ${config.sessionPath}\n`,
      );
      return;
    }
    const { userId } = await runInteractiveLogin(config);
    process.stderr.write(
      `logged in as ${userId}; session saved to ${config.sessionPath}\n`,
    );
    return;
  }

  if (cmd === "logout") {
    const store = new FileSessionStore(config.sessionPath);
    await store.save({ access: null, refresh: null, userId: null, accessExp: null });
    process.stderr.write(`session cleared at ${config.sessionPath}\n`);
    return;
  }

  if (cmd === "whoami") {
    const client = new BeliClient({ store: new FileSessionStore(config.sessionPath) });
    await client.init();
    process.stderr.write(`${client.userId ?? "(not logged in)"}\n`);
    return;
  }

  const { server } = await buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("beli-mcp ready on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`beli-mcp fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
