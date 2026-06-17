import { z } from "zod";
import { Business } from "./business.js";
import { Category, IntId, Uuid } from "./common.js";

/**
 * Add a place to "Want to Try". POST /api/add-bookmark/ -> 200 (empty body).
 * Verified live: ids-only payload works (the app also sends the full business
 * object, but it is optional). `source_id` = the user who suggested it (null = self).
 */
export const AddBookmarkRequest = z
  .object({
    user_id: Uuid,
    business_id: IntId,
    category: Category,
    source_id: Uuid.nullable().default(null),
    res_notifs_enabled: z.boolean().default(false),
    display: z.boolean().default(true),
    /** JS `Date.toString()`-style timestamp the app sends. */
    start_dt: z.string(),
  })
  .passthrough();
export type AddBookmarkRequest = z.infer<typeof AddBookmarkRequest>;

/**
 * Remove a bookmark. PUT /api/remove-bookmark/?supports_guide_item_cleanup=true
 * (same body as add) -> 200 { guide_items_removed }.
 */
export const RemoveBookmarkRequest = z
  .object({
    user_id: Uuid,
    business_id: IntId,
    category: Category,
    display: z.boolean().default(true),
  })
  .passthrough();
export type RemoveBookmarkRequest = z.infer<typeof RemoveBookmarkRequest>;

export const RemoveBookmarkResponse = z
  .object({ guide_items_removed: z.boolean().optional() })
  .passthrough();

/** A row in GET /api/get-bookmark/?user=&category= ("Want to Try"). */
export const BookmarkListItem = z
  .object({
    id: IntId,
    user: Uuid,
    business: Business,
  })
  .passthrough();

/** get-bookmark returns category-keyed arrays, e.g. { "Restaurants": [...] }. */
export const BookmarkListResponse = z.record(z.string(), z.array(BookmarkListItem));
export type BookmarkListItem = z.infer<typeof BookmarkListItem>;
