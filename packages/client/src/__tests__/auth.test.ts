import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BeliClient, type SessionState, type SessionStore } from "@beli/client";

// Build a fake JWT (signature ignored by the client; only exp/user_id are read).
const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (exp: number, uid = "11111111-1111-1111-1111-111111111111") =>
  `h.${b64u({ exp, user_id: uid })}.s`;
const now = () => Math.floor(Date.now() / 1000);

class MemStore implements SessionStore {
  constructor(private s: SessionState) {}
  load() {
    return { ...this.s };
  }
  save(v: SessionState) {
    this.s = { ...v };
  }
  peek() {
    return this.s;
  }
}

const empty = (): SessionState => ({
  access: null,
  refresh: null,
  userId: null,
  accessExp: null,
});

describe("BeliClient interactive auth hook (auto-login)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/get-ranking/")) {
          return new Response(JSON.stringify({ results: [] }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("invokes onAuthRequired when no session exists, then proceeds", async () => {
    const store = new MemStore(empty());
    let hookCalls = 0;

    const client = new BeliClient({
      store,
      onAuthRequired: async () => {
        hookCalls += 1;
        // Simulate a completed browser login writing a fresh session.
        store.save({
          access: jwt(now() + 1200),
          refresh: jwt(now() + 604800),
          userId: "11111111-1111-1111-1111-111111111111",
          accessExp: now() + 1200,
        });
      },
    });
    await client.init();

    const res = await client.getBeen("RES");
    expect(res.results).toEqual([]);
    expect(hookCalls).toBe(1);
    expect(client.userId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("does NOT invoke the hook when a fresh session is already present", async () => {
    const store = new MemStore({
      access: jwt(now() + 1200),
      refresh: jwt(now() + 604800),
      userId: "u",
      accessExp: now() + 1200,
    });
    let hookCalls = 0;
    const client = new BeliClient({
      store,
      onAuthRequired: async () => {
        hookCalls += 1;
      },
    });
    await client.init();
    await client.getBeen("RES");
    expect(hookCalls).toBe(0);
  });

  it("single-flights: concurrent unauthenticated calls trigger the hook once", async () => {
    const store = new MemStore(empty());
    let hookCalls = 0;
    let resolveHook!: () => void;
    const gate = new Promise<void>((r) => (resolveHook = r));

    const client = new BeliClient({
      store,
      // Emulate the server's single-flight wrapper around the real login flow.
      onAuthRequired: (() => {
        let inFlight: Promise<void> | null = null;
        return () => {
          if (!inFlight) {
            inFlight = (async () => {
              hookCalls += 1;
              await gate;
              store.save({
                access: jwt(now() + 1200),
                refresh: jwt(now() + 604800),
                userId: "u",
                accessExp: now() + 1200,
              });
            })().finally(() => (inFlight = null));
          }
          return inFlight;
        };
      })(),
    });
    await client.init();

    const calls = Promise.all([
      client.getBeen("RES"),
      client.getBeen("RES"),
      client.getBeen("RES"),
    ]);
    resolveHook();
    await calls;
    expect(hookCalls).toBe(1);
  });

  it("logout clears the session", async () => {
    const store = new MemStore({
      access: jwt(now() + 1200),
      refresh: jwt(now() + 604800),
      userId: "u",
      accessExp: now() + 1200,
    });
    const client = new BeliClient({ store });
    await client.init();
    expect(client.isAuthenticated()).toBe(true);
    await client.logout();
    expect(client.isAuthenticated()).toBe(false);
    expect(client.userId).toBeNull();
    expect(store.peek().refresh).toBeNull();
  });

  it("throws an actionable error when no hook and no session", async () => {
    const client = new BeliClient({ store: new MemStore(empty()) });
    await client.init();
    await expect(client.getBeen("RES")).rejects.toThrow(/login/i);
  });
});
