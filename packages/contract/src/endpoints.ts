import { z } from "zod";
import type { HostKey } from "./meta.js";
import * as S from "./schemas/index.js";

/**
 * Typed endpoint registry. This is the machine-readable heart of the contract:
 * the client uses it to make calls and the OpenAPI generator walks it. Every
 * entry was confirmed against live traffic (read endpoints 200; writes noted).
 *
 * `path` may contain `{param}` placeholders filled from the call's `params`.
 * `request` is the JSON body schema (POST/PUT). `response` validates the reply.
 * `contentType` defaults to application/json; "multipart" for photo upload.
 */
export interface EndpointDef<
  Req extends z.ZodTypeAny = z.ZodTypeAny,
  Res extends z.ZodTypeAny = z.ZodTypeAny,
> {
  readonly id: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly host: HostKey;
  readonly path: string;
  readonly summary: string;
  readonly auth: boolean;
  readonly request?: Req;
  readonly response: Res;
  readonly contentType?: "json" | "multipart" | "form";
  /** Names of query params the endpoint accepts (documentation only). */
  readonly query?: readonly string[];
}

const def = <Req extends z.ZodTypeAny, Res extends z.ZodTypeAny>(
  e: EndpointDef<Req, Res>,
): EndpointDef<Req, Res> => e;

export const endpoints = {
  // ---- auth ----
  login: def({
    id: "login",
    method: "POST",
    host: "ONBOARD",
    path: "/api/token/",
    summary: "Login by phone + password (DRF SimpleJWT). Returns access+refresh.",
    auth: false,
    request: S.LoginRequest,
    response: S.TokenPair,
  }),
  refresh: def({
    id: "refresh",
    method: "POST",
    host: "ONBOARD",
    path: "/api/token/refresh/",
    summary: "Exchange refresh token for a new access token.",
    auth: false,
    request: S.RefreshRequest,
    response: S.RefreshResponse,
  }),
  loggedIn: def({
    id: "loggedIn",
    method: "GET",
    host: "ONBOARD",
    path: "/api/user/logged-in/",
    summary: "Current authenticated user (results[0].id is your uuid).",
    auth: true,
    response: S.LoggedInResponse,
  }),

  // ---- discovery ----
  searchPlaces: def({
    id: "searchPlaces",
    method: "GET",
    host: "API",
    path: "/api/search-app/",
    summary: "Place typeahead (Google Places autocomplete, proxied + cached).",
    auth: true,
    response: S.SearchResponse,
    query: ["term", "city", "coords", "user"],
  }),
  business: def({
    id: "business",
    method: "GET",
    host: "API",
    path: "/api/business/",
    summary: "Business detail by integer id or Google place_id (get-or-create).",
    auth: true,
    response: S.BusinessResponse,
    query: ["id", "place_id", "from_business_page"],
  }),
  searchMembers: def({
    id: "searchMembers",
    method: "GET",
    host: "API",
    path: "/api/user/search/{viewer}/{query}/",
    summary: "Member search by name/username.",
    auth: true,
    response: z.object({ results: z.array(S.MemberSummary) }).passthrough(),
    query: ["page", "include_followed"],
  }),

  // ---- lists ----
  getRanking: def({
    id: "getRanking",
    method: "GET",
    host: "API",
    path: "/api/get-ranking/",
    summary: "A user's ranked 'Been' list for a category.",
    auth: true,
    response: S.RankingListResponse,
    query: ["user", "category"],
  }),
  getBookmark: def({
    id: "getBookmark",
    method: "GET",
    host: "API",
    path: "/api/get-bookmark/",
    summary: "A user's 'Want to Try' bookmarks for a category.",
    auth: true,
    response: S.BookmarkListResponse,
    query: ["user", "category"],
  }),

  // ---- reviews (writes) ----
  addRanking: def({
    id: "addRanking",
    method: "POST",
    host: "API",
    path: "/api/add-ranking/",
    summary: "Create a ranked review entry. Returns ranking id + server score.",
    auth: true,
    request: S.AddRankingRequest,
    response: S.AddRankingResponse,
    query: ["playlists_v2"],
  }),
  processAddRanking: def({
    id: "processAddRanking",
    method: "POST",
    host: "API",
    path: "/api/process-add-ranking/",
    summary: "Post-processing fired right after add-ranking (same body).",
    auth: true,
    request: S.AddRankingRequest,
    response: z.object({}).passthrough(),
  }),
  checkSharePostRank: def({
    id: "checkSharePostRank",
    method: "POST",
    host: "API",
    path: "/api/check-share-post-rank/",
    summary: "Pre-check for post-rank popups (ranking body with value:null).",
    auth: true,
    request: S.AddRankingRequest,
    response: z.object({ post_rank_popups: z.array(z.unknown()) }).passthrough(),
    query: ["supports_multiple_featured_list_challenges"],
  }),

  // ---- photos (writes) ----
  uploadPhoto: def({
    id: "uploadPhoto",
    method: "POST",
    host: "API",
    path: "/api/user-business-photo/",
    summary: "Upload one photo for a business (multipart). Returns the photo id.",
    auth: true,
    request: S.UploadPhotoFields,
    response: S.UploadPhotoResponse,
    contentType: "multipart",
  }),
  listPhotos: def({
    id: "listPhotos",
    method: "GET",
    host: "API",
    path: "/api/user-business-photo/",
    summary: "List a user's photos for a business.",
    auth: true,
    response: S.PhotoListResponse,
    query: ["user", "business"],
  }),
  updatePhoto: def({
    id: "updatePhoto",
    method: "PUT",
    host: "API",
    path: "/api/user-business-photo/{id}/",
    summary: "Update a photo's status (soft-delete via status=DELETED).",
    auth: true,
    request: S.UpdatePhotoRequest,
    response: z.object({}).passthrough(),
  }),

  // ---- bookmarks (writes) ----
  addBookmark: def({
    id: "addBookmark",
    method: "POST",
    host: "API",
    path: "/api/add-bookmark/",
    summary: "Add a place to 'Want to Try'.",
    auth: true,
    request: S.AddBookmarkRequest,
    response: z.object({}).passthrough(),
  }),
  removeBookmark: def({
    id: "removeBookmark",
    method: "PUT",
    host: "API",
    path: "/api/remove-bookmark/",
    summary: "Remove a place from 'Want to Try'.",
    auth: true,
    request: S.RemoveBookmarkRequest,
    response: S.RemoveBookmarkResponse,
    query: ["supports_guide_item_cleanup"],
  }),
} as const;

export type EndpointId = keyof typeof endpoints;
export type Endpoints = typeof endpoints;
