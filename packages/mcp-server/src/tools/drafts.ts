import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppContext, fail, guard, ok } from "../context.js";

const Category = z.enum(["RES", "BAR", "COFFEE", "BAKERY", "DESSERT", "OTHER"]);
const Sentiment = z.enum(["liked", "fine", "disliked"]);

/**
 * Local drafts: compose a full review (place, sentiment, date, photos+captions)
 * offline and submit it atomically. Nothing hits the Beli API until draft_submit.
 */
export function registerDraftTools(server: McpServer, ctx: AppContext): void {
  server.registerTool(
    "draft_create",
    {
      title: "Create draft",
      description: "Start a local review draft (nothing is sent to Beli yet).",
      inputSchema: {
        businessId: z.number().int(),
        name: z.string().optional(),
        category: Category.default("RES"),
        sentiment: Sentiment.default("liked"),
        visitDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    guard(async (args) => ok(await ctx.drafts.create(args))),
  );

  server.registerTool(
    "draft_add_photo",
    {
      title: "Add photo to draft",
      description: "Attach a local photo (with optional caption) to a draft.",
      inputSchema: {
        id: z.string(),
        imagePath: z.string(),
        description: z.string().optional(),
        favoriteDish: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    guard(async ({ id, imagePath, description, favoriteDish }) =>
      ok(await ctx.drafts.addPhoto(id, { path: imagePath, description, favoriteDish })),
    ),
  );

  server.registerTool(
    "draft_set",
    {
      title: "Update draft",
      description: "Update fields on a draft.",
      inputSchema: {
        id: z.string(),
        category: Category.optional(),
        sentiment: Sentiment.optional(),
        visitDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    guard(async ({ id, ...patch }) => ok(await ctx.drafts.update(id, patch))),
  );

  server.registerTool(
    "draft_list",
    {
      title: "List drafts",
      description: "List all local review drafts.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async () => ok(await ctx.drafts.list())),
  );

  server.registerTool(
    "draft_show",
    {
      title: "Show draft",
      description: "Show one draft by id.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guard(async ({ id }) => {
      const d = await ctx.drafts.get(id);
      return d ? ok(d) : fail(`draft ${id} not found`);
    }),
  );

  server.registerTool(
    "draft_discard",
    {
      title: "Discard draft",
      description: "Delete a local draft without submitting.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    guard(async ({ id }) => ok({ discarded: await ctx.drafts.discard(id) })),
  );

  server.registerTool(
    "draft_submit",
    {
      title: "Submit draft",
      description:
        "Submit a draft to Beli: creates the ranking and uploads its photos in order. " +
        "WRITE: mutates your account. On success the draft is discarded.",
      inputSchema: { id: z.string(), confirm: z.boolean().optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    guard(async ({ id, confirm }) => {
      ctx.assertWrite(confirm);
      const d = await ctx.drafts.get(id);
      if (!d) return fail(`draft ${id} not found`);

      const photos = await Promise.all(
        d.photos.map(async (p) => ({
          image: new Uint8Array(await readFile(p.path)),
          filename: basename(p.path),
          description: p.description ?? "",
          favoriteDish: p.favoriteDish ?? false,
        })),
      );

      await ctx.throttle();
      const result = await ctx.client.submitReview({
        businessId: d.businessId,
        category: d.category as "RES",
        sentiment: d.sentiment,
        visitDate: d.visitDate,
        photos,
      });
      await ctx.drafts.discard(id);
      return ok({
        rankingId: result.ranking.results.id,
        score: result.ranking.score,
        photoIds: result.photoIds,
      });
    }),
  );
}
