import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppContext, guard, ok } from "../context.js";

const Category = z
  .enum(["RES", "BAR", "COFFEE", "BAKERY", "DESSERT", "OTHER"])
  .default("RES");
const Sentiment = z.enum(["liked", "fine", "disliked"]).default("liked");

export function registerReviewTools(server: McpServer, ctx: AppContext): void {
  server.registerTool(
    "rank_place",
    {
      title: "Rank a place (Been)",
      description:
        "Create a ranked 'Been' review for a business. WRITE: mutates your account. " +
        "The 0–10 score is computed by Beli (first-ever ranking = 10). To attach " +
        "photos in the same flow, use submit_draft or upload_photo afterwards.",
      inputSchema: {
        businessId: z.number().int(),
        category: Category,
        sentiment: Sentiment.describe("liked=green, fine=yellow, disliked=red"),
        visitDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("YYYY-MM-DD; defaults to today"),
        confirm: z.boolean().optional().describe("required unless writes are enabled"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guard(async ({ businessId, category, sentiment, visitDate, confirm }) => {
      ctx.assertWrite(confirm);
      await ctx.throttle();
      const r = await ctx.client.addRanking({
        businessId,
        category,
        sentiment,
        visitDate,
      });
      return ok({
        rankingId: r.results.id,
        score: r.score,
        feedItemId: r.feed_item_id,
        business: r.results.business.name,
        visitDates: r.results.visit_dates,
      });
    }),
  );
}
