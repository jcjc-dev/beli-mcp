import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppContext, guard, ok } from "../context.js";

const Category = z
  .enum(["RES", "BAR", "COFFEE", "BAKERY", "DESSERT", "OTHER"])
  .default("RES");

export function registerBookmarkTools(server: McpServer, ctx: AppContext): void {
  server.registerTool(
    "bookmark",
    {
      title: "Bookmark (Want to Try)",
      description: "Add a place to your 'Want to Try' list. WRITE: mutates your account.",
      inputSchema: {
        businessId: z.number().int(),
        category: Category,
        resNotifs: z.boolean().optional().describe("reservation-availability alerts"),
        confirm: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async ({ businessId, category, resNotifs, confirm }) => {
      ctx.assertWrite(confirm);
      await ctx.throttle();
      await ctx.client.bookmark({ businessId, category, resNotifs });
      return ok({ bookmarked: businessId, category });
    }),
  );

  server.registerTool(
    "unbookmark",
    {
      title: "Remove bookmark",
      description: "Remove a place from your 'Want to Try' list. WRITE: mutates your account.",
      inputSchema: {
        businessId: z.number().int(),
        category: Category,
        confirm: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async ({ businessId, category, confirm }) => {
      ctx.assertWrite(confirm);
      await ctx.throttle();
      const r = await ctx.client.unbookmark({ businessId, category });
      return ok(r);
    }),
  );
}
