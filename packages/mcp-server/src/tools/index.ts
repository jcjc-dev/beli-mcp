import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppContext } from "../context.js";
import { registerAuthTools } from "./auth.js";
import { registerDiscoveryTools } from "./discovery.js";
import { registerListTools } from "./lists.js";
import { registerReviewTools } from "./reviews.js";
import { registerPhotoTools } from "./photos.js";
import { registerBookmarkTools } from "./bookmarks.js";
import { registerDraftTools } from "./drafts.js";

export function registerAllTools(server: McpServer, ctx: AppContext): void {
  registerAuthTools(server, ctx);
  registerDiscoveryTools(server, ctx);
  registerListTools(server, ctx);
  registerReviewTools(server, ctx);
  registerPhotoTools(server, ctx);
  registerBookmarkTools(server, ctx);
  registerDraftTools(server, ctx);
}
