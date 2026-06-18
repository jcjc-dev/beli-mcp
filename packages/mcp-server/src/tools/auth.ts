import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AppContext, guard, ok } from "../context.js";

export function registerAuthTools(server: McpServer, ctx: AppContext): void {
  server.registerTool(
    "login",
    {
      title: "Log in to Beli",
      description:
        "Open a browser to sign in to Beli. Persists only tokens (~7 days); your " +
        "password is never stored. Use this when tools report you are not signed in. " +
        "Note: most tools also trigger this popup automatically when no session exists.",
      inputSchema: {},
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    guard(async () => {
      const { userId } = await ctx.interactiveLogin();
      return ok({ loggedIn: Boolean(userId), userId });
    }),
  );

  server.registerTool(
    "logout",
    {
      title: "Log out of Beli",
      description:
        "Clear the locally saved Beli session. Does not revoke the tokens " +
        "server-side (they expire naturally, ~7 days).",
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    guard(async () => {
      await ctx.client.logout();
      return ok({ loggedOut: true });
    }),
  );

  server.registerTool(
    "auth_status",
    {
      title: "Auth status",
      description: "Report whether you are signed in to Beli and as which user id.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async () =>
      ok({
        authenticated: ctx.client.isAuthenticated(),
        userId: ctx.client.userId,
      }),
    ),
  );
}
