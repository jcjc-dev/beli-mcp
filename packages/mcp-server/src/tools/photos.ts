import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppContext, guard, ok } from "../context.js";

export function registerPhotoTools(server: McpServer, ctx: AppContext): void {
  server.registerTool(
    "upload_photo",
    {
      title: "Upload photo",
      description:
        "Upload one photo for a business from a local file path. WRITE: mutates your " +
        "account. A photo can be uploaded WITHOUT a ranking — it appears in your " +
        "profile photos but not on the public business page until you rank.",
      inputSchema: {
        businessId: z.number().int(),
        imagePath: z.string().describe("absolute path to a local image file"),
        description: z.string().optional().describe("caption / dish name"),
        order: z.number().int().optional().describe("explicit display position"),
        favoriteDish: z.boolean().optional(),
        confirm: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    guard(
      async ({ businessId, imagePath, description, order, favoriteDish, confirm }) => {
        ctx.assertWrite(confirm);
        const buf = await readFile(imagePath);
        await ctx.throttle();
        const r = await ctx.client.uploadPhoto({
          businessId,
          image: new Uint8Array(buf),
          filename: basename(imagePath),
          description: description ?? "",
          order: order ?? 0,
          favoriteDish: favoriteDish ?? false,
        });
        return ok({ photoId: r.id });
      },
    ),
  );

  server.registerTool(
    "list_photos",
    {
      title: "List photos",
      description: "List your photos for a business.",
      inputSchema: { businessId: z.number().int(), userId: z.string().uuid().optional() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ businessId, userId }) => {
      await ctx.throttle();
      const res = await ctx.client.listPhotos(businessId, userId);
      return ok(res.results);
    }),
  );

  server.registerTool(
    "delete_photo",
    {
      title: "Delete photo",
      description: "Soft-delete a photo (status=DELETED). WRITE: mutates your account.",
      inputSchema: { photoId: z.number().int(), confirm: z.boolean().optional() },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    guard(async ({ photoId, confirm }) => {
      ctx.assertWrite(confirm);
      await ctx.throttle();
      await ctx.client.deletePhoto(photoId);
      return ok({ deleted: photoId });
    }),
  );
}
