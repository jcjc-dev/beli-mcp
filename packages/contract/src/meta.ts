/**
 * Provenance + connection metadata for the reverse-engineered Beli contract.
 * This is a SNAPSHOT of a private API (app v9.3.1); Beli makes no compatibility
 * guarantee. Treat breaking changes as expected and re-verify against the app.
 */
export const HOSTS = {
  /** Auth/token + user/logged-in. */
  ONBOARD: "https://backoffice-service-onboarding-t57o3dxfca-nn.a.run.app",
  /** Main API: feed, profile, lists, search, rankings, photos, bookmarks. */
  API: "https://backoffice-service-t57o3dxfca-nn.a.run.app",
  /** Recommendations. */
  RECS: "https://backoffice-service-recs-t57o3dxfca-nn.a.run.app",
  /** Analytics sink (fire-and-forget). */
  ACTIVITY:
    "https://activity-service-978733420956.northamerica-northeast1.run.app",
} as const;
export type HostKey = keyof typeof HOSTS;

export const META = {
  appVersion: "9.3.1",
  appBuild: "413",
  packageName: "com.beliapp.myapp",
  reversedOn: "2026-06-14",
  /** Every authenticated request needs these (missing Origin -> 403). */
  requiredHeaders: {
    Origin: "https://localhost",
    Referer: "https://localhost/",
  },
  /** Token lifetimes observed from decoded JWTs. */
  token: {
    accessTtlSeconds: 20 * 60,
    refreshTtlSeconds: 7 * 24 * 60 * 60,
    /** /api/token/refresh/ returns a new access only (refresh is NOT rotated). */
    refreshRotates: false,
  },
} as const;
