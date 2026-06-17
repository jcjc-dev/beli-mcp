import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppContext, guard, ok } from "../context.js";

const Category = z
  .enum(["RES", "BAR", "COFFEE", "BAKERY", "DESSERT", "OTHER"])
  .default("RES");

export function registerListTools(server: McpServer, ctx: AppContext): void {
  server.registerTool(
    "get_been",
    {
      title: "Get Been list",
      description:
        "List a user's ranked 'Been' places for a category. Omit userId for yourself.",
      inputSchema: { category: Category, userId: z.string().uuid().optional() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ category, userId }) => {
      await ctx.throttle();
      const res = await ctx.client.getBeen(category, userId);
      return ok(res.results);
    }),
  );

  server.registerTool(
    "get_want_to_try",
    {
      title: "Get Want-to-Try list",
      description:
        "List a user's 'Want to Try' bookmarks for a category. Omit userId for yourself.",
      inputSchema: { category: Category, userId: z.string().uuid().optional() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ category, userId }) => {
      await ctx.throttle();
      return ok(await ctx.client.getWantToTry(category, userId));
    }),
  );
}
