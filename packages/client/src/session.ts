/**
 * Session state + token lifecycle. One login yields a 7-day refresh token; the
 * 20-minute access token is refreshed automatically. A SessionStore lets the
 * caller (e.g. the MCP server) persist tokens to disk so you "log in once".
 */
export interface SessionState {
  access: string | null;
  refresh: string | null;
  userId: string | null;
  /** Unix seconds when the access token expires (decoded from the JWT). */
  accessExp: number | null;
}

export interface SessionStore {
  load(): Promise<SessionState> | SessionState;
  save(state: SessionState): Promise<void> | void;
}

export const emptySession = (): SessionState => ({
  access: null,
  refresh: null,
  userId: null,
  accessExp: null,
});

/** In-memory store (no persistence). */
export class MemorySessionStore implements SessionStore {
  private state: SessionState = emptySession();
  load(): SessionState {
    return this.state;
  }
  save(state: SessionState): void {
    this.state = state;
  }
}

/** Decode a JWT payload without verifying the signature. */
export function decodeJwt(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Read the `exp` (unix seconds) and `user_id` claims from an access token. */
export function readAccessClaims(token: string): {
  exp: number | null;
  userId: string | null;
} {
  const p = decodeJwt(token);
  return {
    exp: typeof p?.exp === "number" ? p.exp : null,
    userId: typeof p?.user_id === "string" ? p.user_id : null,
  };
}
