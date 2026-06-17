import { z } from "zod";
import { Business } from "./business.js";
import { Category, IntId, IsoDate, IsoDateTime, Uuid } from "./common.js";

/**
 * Request body for POST /api/add-ranking/?playlists_v2=true and the sibling
 * calls POST /api/process-add-ranking/ and POST /api/check-share-post-rank/
 * (which all send the same shape; check-share sends value:null).
 *
 * `value` is the sentiment seed (see Sentiment/SENTIMENT_VALUE). The displayed
 * 0–10 score is computed server-side. Verified live against v9.3.1.
 */
export const AddRankingRequest = z
  .object({
    category: Category,
    user_id: Uuid,
    business_id: IntId,
    value: z.number().nullable(),
    tagged_users: z.array(Uuid).default([]),
    local_datetime: IsoDateTime,
    utc_offset: z.number().int(),
    visit_dates: z.array(IsoDate),
    visit_date_on_rank: IsoDate.nullable().optional(),
    rank_button_source: z.string().nullable().default(null),
    overall_rank_count: z.number().int().optional(),

    // client capability flags the app sends; safe, mostly constant booleans.
    version_supports_multi_category: z.boolean().optional(),
    has_access_multi_category: z.boolean().optional(),
    has_new_challenge_share_page: z.boolean().optional(),
    has_new_streak_share_page: z.boolean().optional(),
    has_non_challenge_annual_milestones: z.boolean().optional(),
    has_new_milestone_share_page: z.boolean().optional(),
    supports_featured_list_challenges: z.boolean().optional(),
    supports_process_ranking_share_profile: z.boolean().optional(),
  })
  .passthrough();
export type AddRankingRequest = z.infer<typeof AddRankingRequest>;

/** The ranking sub-object inside the add-ranking response. */
export const RankingResult = z
  .object({
    id: IntId,
    user: Uuid,
    business: Business,
    value: z.number().nullable(),
    category: Category,
    created_dt: IsoDateTime,
    visit_dates: z.array(IsoDate),
    score: z.number().nullable(),
  })
  .passthrough();

/**
 * Response from POST /api/add-ranking/. `score` (top-level) is the resolved
 * 0–10 value (first-ever ranking returns 10.0). `feed_item_id` is the created
 * social feed entry.
 */
export const AddRankingResponse = z
  .object({
    results: RankingResult,
    code: z.number().optional(),
    message: z.string().optional(),
    feed_item_id: IntId.nullable().optional(),
    score: z.number().nullable().optional(),
  })
  .passthrough();
export type AddRankingResponse = z.infer<typeof AddRankingResponse>;

/** A row in GET /api/get-ranking/?user=&category= (a user's "Been" list). */
export const RankingListItem = z
  .object({
    id: IntId,
    user: Uuid,
    business: Business,
    score: z.number().nullable().optional(),
    value: z.number().nullable().optional(),
    visit_dates: z.array(IsoDate).optional(),
  })
  .passthrough();
export const RankingListResponse = z.object({ results: z.array(RankingListItem) });
export type RankingListItem = z.infer<typeof RankingListItem>;
