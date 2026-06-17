import {
  endpoints,
  SENTIMENT_VALUE,
  type Category,
  type EndpointId,
  type Endpoints,
  type Sentiment,
} from "@beli/contract";
import type { z } from "zod";
import { baseHeaders, BeliApiError, buildUrl } from "./http.js";
import {
  emptySession,
  MemorySessionStore,
  readAccessClaims,
  type SessionState,
  type SessionStore,
} from "./session.js";

export interface BeliClientOptions {
  phone?: string;
  password?: string;
  /** Pluggable persistence so one login survives across runs. */
  store?: SessionStore;
}

interface RequestOpts {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

type ResponseOf<K extends EndpointId> = z.infer<Endpoints[K]["response"]>;

const ACCESS_SKEW_SECONDS = 120;

export class BeliClient {
  private state: SessionState = emptySession();
  private readonly store: SessionStore;
  private bootstrapped = false;
  private refreshInFlight: Promise<void> | null = null;

  constructor(private readonly opts: BeliClientOptions = {}) {
    this.store = opts.store ?? new MemorySessionStore();
  }

  /** Load any persisted session (call once before use). */
  async init(): Promise<void> {
    if (this.bootstrapped) return;
    this.state = { ...emptySession(), ...(await this.store.load()) };
    this.bootstrapped = true;
  }

  get userId(): string | null {
    return this.state.userId;
  }

  isAuthenticated(): boolean {
    return Boolean(this.state.access || this.state.refresh);
  }

  // ---- auth ----
  /**
   * Exchange phone + password for tokens and persist them. Credentials may be
   * supplied here (e.g. from an interactive login) or via constructor options;
   * they are used once and never stored — only the resulting tokens are saved.
   */
  async login(creds?: { phone: string; password: string }): Promise<void> {
    const phone = creds?.phone ?? this.opts.phone;
    const password = creds?.password ?? this.opts.password;
    if (!phone || !password) {
      throw new Error("login requires phone + password");
    }
    const e = endpoints.login;
    const res = await fetch(buildUrl(e.host, e.path), {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ phone_no: phone, password }),
    });
    const text = await res.text();
    if (!res.ok) throw new BeliApiError(res.status, e.id, text);
    const tok = e.response.parse(JSON.parse(text));
    const claims = readAccessClaims(tok.access);
    this.state = {
      access: tok.access,
      refresh: tok.refresh,
      userId: claims.userId,
      accessExp: claims.exp,
    };
    await this.store.save(this.state);
  }

  async refreshToken(): Promise<void> {
    if (!this.state.refresh) throw new Error("no refresh token");
    const e = endpoints.refresh;
    const res = await fetch(buildUrl(e.host, e.path), {
      method: "POST",
      headers: { ...baseHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: this.state.refresh }),
    });
    const text = await res.text();
    if (!res.ok) throw new BeliApiError(res.status, e.id, text);
    const { access } = e.response.parse(JSON.parse(text));
    const claims = readAccessClaims(access);
    this.state = {
      ...this.state,
      access,
      userId: claims.userId ?? this.state.userId,
      accessExp: claims.exp,
    };
    await this.store.save(this.state);
  }

  private accessFresh(): boolean {
    const now = Math.floor(Date.now() / 1000);
    return Boolean(
      this.state.access &&
        this.state.accessExp &&
        this.state.accessExp - now > ACCESS_SKEW_SECONDS,
    );
  }

  /** Refresh the access token, de-duplicating concurrent callers (single-flight). */
  private refreshSingleFlight(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshToken().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  /** Try to obtain a usable access token via refresh, then credentials. */
  private async tryRefreshOrLogin(): Promise<boolean> {
    if (this.state.refresh) {
      try {
        await this.refreshSingleFlight();
        return true;
      } catch {
        /* refresh token expired/invalid — fall through */
      }
    }
    if (this.opts.phone && this.opts.password) {
      try {
        await this.login();
        return true;
      } catch {
        /* bad credentials — fall through */
      }
    }
    return false;
  }

  private async authenticate(force: boolean): Promise<void> {
    if (!force && this.accessFresh()) return;

    if (await this.tryRefreshOrLogin()) return;

    // Last resort: an out-of-band `login` (separate process) may have written a
    // fresh session since we loaded. Reload from disk and retry once if it changed.
    const prevRefresh = this.state.refresh;
    this.state = { ...emptySession(), ...(await this.store.load()) };
    if (this.accessFresh()) return;
    if (this.state.refresh && this.state.refresh !== prevRefresh) {
      if (await this.tryRefreshOrLogin()) return;
    }

    throw new Error(
      "Beli session expired or missing. Run `npx beli-mcp login` to sign in.",
    );
  }

  private requireUserId(): string {
    if (!this.state.userId) {
      throw new Error("missing user id; call login()/me() first");
    }
    return this.state.userId;
  }

  // ---- generic typed request ----
  async request<K extends EndpointId>(
    id: K,
    opts: RequestOpts = {},
  ): Promise<ResponseOf<K>> {
    const e = endpoints[id];
    if (e.auth) await this.authenticate(false);

    const url = buildUrl(e.host, e.path, opts.params, opts.query);
    const doFetch = async (): Promise<Response> => {
      const headers: Record<string, string> = { ...baseHeaders() };
      if (e.auth && this.state.access) {
        headers.Authorization = `Bearer ${this.state.access}`;
      }
      const init: RequestInit = { method: e.method, headers };
      if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(opts.body);
      }
      return fetch(url, init);
    };

    let res = await doFetch();
    if (res.status === 401 && e.auth) {
      await this.authenticate(true);
      res = await doFetch();
    }
    const text = await res.text();
    if (!res.ok) throw new BeliApiError(res.status, e.id, text);
    const json = text ? JSON.parse(text) : {};
    return e.response.parse(json) as ResponseOf<K>;
  }

  // ---- discovery ----
  searchPlaces(term: string, city = "", coords = " ") {
    return this.request("searchPlaces", {
      query: { term, city, coords, user: this.requireUserId() },
    });
  }

  businessByPlace(placeId: string) {
    return this.request("business", { query: { place_id: placeId } });
  }

  businessById(id: number) {
    return this.request("business", {
      query: { id, from_business_page: "true" },
    });
  }

  /** Resolve a name+location to an integer business id (inline id or place_id). */
  async findBusinessId(
    term: string,
    city = "",
    coords = " ",
  ): Promise<{ businessId: number | null; name: string | null }> {
    const { predictions } = await this.searchPlaces(term, city, coords);
    const top = predictions[0];
    if (!top) return { businessId: null, name: null };
    const name = top.structured_formatting?.main_text ?? null;
    if (typeof top.business === "number") {
      return { businessId: top.business, name };
    }
    const biz = await this.businessByPlace(top.place_id);
    const list = (biz as { results?: unknown }).results;
    const resolved = (Array.isArray(list) ? list[0] : biz) as
      | { id?: number; name?: string }
      | undefined;
    return { businessId: resolved?.id ?? null, name: resolved?.name ?? name };
  }

  // ---- lists ----
  getBeen(category: Category = "RES", user?: string) {
    return this.request("getRanking", {
      query: { user: user ?? this.requireUserId(), category },
    });
  }

  getWantToTry(category: Category = "RES", user?: string) {
    return this.request("getBookmark", {
      query: { user: user ?? this.requireUserId(), category },
    });
  }

  // ---- reviews ----
  private rankingPayload(
    businessId: number,
    category: Category,
    value: number | null,
    visitDate: string,
    taggedUsers: string[] = [],
  ) {
    const now = new Date();
    return {
      category,
      user_id: this.requireUserId(),
      business_id: businessId,
      value,
      tagged_users: taggedUsers,
      local_datetime: now.toISOString(),
      utc_offset: now.getTimezoneOffset(),
      visit_dates: [visitDate],
      visit_date_on_rank: visitDate,
      rank_button_source: null,
      overall_rank_count: 1,
      version_supports_multi_category: true,
      has_access_multi_category: false,
      has_new_challenge_share_page: true,
      has_new_streak_share_page: true,
      has_non_challenge_annual_milestones: true,
      has_new_milestone_share_page: true,
      supports_featured_list_challenges: true,
      supports_process_ranking_share_profile: true,
    };
  }

  /** Create a ranked "Been" entry (+ fire the app's post-processing call). */
  async addRanking(args: {
    businessId: number;
    category?: Category;
    sentiment?: Sentiment;
    visitDate?: string;
    taggedUsers?: string[];
  }) {
    const category = args.category ?? "RES";
    const visitDate = args.visitDate ?? new Date().toISOString().slice(0, 10);
    const value = SENTIMENT_VALUE[args.sentiment ?? "liked"];
    const body = this.rankingPayload(
      args.businessId,
      category,
      value,
      visitDate,
      args.taggedUsers,
    );
    const result = await this.request("addRanking", {
      query: { playlists_v2: "true" },
      body,
    });
    try {
      await this.request("processAddRanking", { body });
    } catch {
      /* non-fatal post-processing */
    }
    return result;
  }

  // ---- photos ----
  async uploadPhoto(args: {
    businessId: number;
    image: Blob | Uint8Array;
    filename?: string;
    description?: string;
    order?: number;
    favoriteDish?: boolean;
  }): Promise<{ id: number }> {
    await this.authenticate(false);
    const fd = new FormData();
    const blob =
      args.image instanceof Blob
        ? args.image
        : new Blob([args.image], { type: "image/jpeg" });
    fd.set("image", blob, args.filename ?? "photo.jpg");
    fd.set("business", String(args.businessId));
    fd.set("user", this.requireUserId());
    fd.set("description", args.description ?? "");
    fd.set("order", String(args.order ?? 0));
    fd.set("favorite_dish", args.favoriteDish ? "true" : "false");

    const e = endpoints.uploadPhoto;
    const res = await fetch(buildUrl(e.host, e.path), {
      method: "POST",
      headers: { ...baseHeaders(), Authorization: `Bearer ${this.state.access}` },
      body: fd,
    });
    const text = await res.text();
    if (!res.ok) throw new BeliApiError(res.status, e.id, text);
    return e.response.parse(JSON.parse(text));
  }

  listPhotos(businessId: number, user?: string) {
    return this.request("listPhotos", {
      query: { user: user ?? this.requireUserId(), business: businessId },
    });
  }

  /** Soft-delete a photo (status=DELETED). */
  deletePhoto(photoId: number) {
    return this.request("updatePhoto", {
      params: { id: photoId },
      body: { status: "DELETED" },
    });
  }

  /** End-to-end: create the ranking, then upload photos in explicit order. */
  async submitReview(args: {
    businessId: number;
    category?: Category;
    sentiment?: Sentiment;
    visitDate?: string;
    photos?: Array<{
      image: Blob | Uint8Array;
      filename?: string;
      description?: string;
      favoriteDish?: boolean;
    }>;
  }) {
    const ranking = await this.addRanking(args);
    const photoIds: number[] = [];
    const photos = args.photos ?? [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i]!;
      const r = await this.uploadPhoto({
        businessId: args.businessId,
        image: p.image,
        filename: p.filename,
        description: p.description ?? "",
        order: i,
        favoriteDish: p.favoriteDish ?? false,
      });
      photoIds.push(r.id);
    }
    return { ranking, photoIds };
  }

  // ---- bookmarks ----
  async bookmark(args: {
    businessId: number;
    category?: Category;
    resNotifs?: boolean;
    sourceId?: string | null;
  }) {
    const body = {
      user_id: this.requireUserId(),
      business_id: args.businessId,
      source_id: args.sourceId ?? null,
      category: args.category ?? "RES",
      res_notifs_enabled: args.resNotifs ?? false,
      display: true,
      start_dt: new Date().toString(),
    };
    return this.request("addBookmark", { body });
  }

  unbookmark(args: { businessId: number; category?: Category }) {
    return this.request("removeBookmark", {
      query: { supports_guide_item_cleanup: "true" },
      body: {
        user_id: this.requireUserId(),
        business_id: args.businessId,
        category: args.category ?? "RES",
        display: true,
      },
    });
  }
}
