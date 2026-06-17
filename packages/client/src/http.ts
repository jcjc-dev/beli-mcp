import { HOSTS, META, type HostKey } from "@beli/contract";

/** Error thrown for non-2xx API responses, carrying status + body for triage. */
export class BeliApiError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    readonly body: string,
  ) {
    super(`Beli API ${endpoint} -> ${status}: ${body.slice(0, 300)}`);
    this.name = "BeliApiError";
  }
}

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 16; SM-S928U) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/149.0.7827.91 Mobile Safari/537.36";

/** Headers every request must carry (Origin/Referer are gateway requirements). */
export function baseHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    Origin: META.requiredHeaders.Origin,
    Referer: META.requiredHeaders.Referer,
    "User-Agent": USER_AGENT,
  };
}

/** Build a full URL from a host key, path template, path params and query. */
export function buildUrl(
  host: HostKey,
  path: string,
  params?: Record<string, string | number>,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  let filled = path;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      filled = filled.replace(`{${k}}`, encodeURIComponent(String(v)));
    }
  }
  const url = new URL(HOSTS[host] + filled);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}
