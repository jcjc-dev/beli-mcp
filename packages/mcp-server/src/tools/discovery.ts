import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppContext, guard, ok } from "../context.js";

export function registerDiscoveryTools(server: McpServer, ctx: AppContext): void {
  server.registerTool(
    "search_places",
    {
      title: "Search places",
      description:
        "Search restaurants/bars by name near a location (Google Places autocomplete). " +
        "Returns predictions with a Google place_id and, when the place already " +
        "exists in Beli, an inline integer `business` id.",
      inputSchema: {
        term: z.string().describe("search text, e.g. 'Ramen Danbo'"),
        city: z.string().optional().describe("e.g. 'Seattle, WA'"),
        coords: z.string().optional().describe("'lat,lng' to bias results"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ term, city, coords }) => {
      await ctx.throttle();
      const res = await ctx.client.searchPlaces(term, city ?? "", coords ?? " ");
      return ok(res.predictions);
    }),
  );

  server.registerTool(
    "find_business",
    {
      title: "Find business id",
      description:
        "Resolve a place name + location to a single Beli integer business_id " +
        "(the id needed to rank or bookmark). Uses the inline id when available, " +
        "otherwise resolves the Google place_id (get-or-create).",
      inputSchema: {
        term: z.string(),
        city: z.string().optional(),
        coords: z.string().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ term, city, coords }) => {
      await ctx.throttle();
      const r = await ctx.client.findBusinessId(term, city ?? "", coords ?? " ");
      return ok(r);
    }),
  );

  server.registerTool(
    "business_detail",
    {
      title: "Business detail",
      description: "Get full details for a business by its integer id.",
      inputSchema: { businessId: z.number().int() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ businessId }) => {
      await ctx.throttle();
      return ok(await ctx.client.businessById(businessId));
    }),
  );
}
