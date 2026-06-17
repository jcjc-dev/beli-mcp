import { BeliClient } from "@beli/client";
import type { Config } from "./config.js";
import type { DraftStore } from "./drafts/store.js";

export interface ToolResult {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export const ok = (data: unknown): ToolResult => ({
  content: [
    {
      type: "text",
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    },
  ],
});

export const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

/** Shared dependencies passed to every tool registrar. */
export class AppContext {
  private lastCall = 0;

  constructor(
    readonly client: BeliClient,
    readonly drafts: DraftStore,
    readonly config: Config,
  ) {}

  /** Politeness throttle between outbound API calls. */
  async throttle(): Promise<void> {
    const wait = this.lastCall + this.config.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();
  }

  /** Enforce the write-safety gate. Throws if writes are not permitted. */
  assertWrite(confirm: boolean | undefined): void {
    if (this.config.allowWrites) return;
    if (confirm === true) return;
    throw new WriteBlockedError();
  }
}

export class WriteBlockedError extends Error {
  constructor() {
    super(
      "Write blocked. This mutates your real Beli account. Re-run the tool with " +
        "confirm: true, or start the server with BELI_ALLOW_WRITES=1 to allow writes.",
    );
    this.name = "WriteBlockedError";
  }
}

/** Wrap a tool handler so thrown errors become structured error results. */
export function guard<A>(
  handler: (args: A) => Promise<ToolResult>,
): (args: A) => Promise<ToolResult> {
  return async (args: A) => {
    try {
      return await handler(args);
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      if (/authentication required|login requires|no refresh token/i.test(msg)) {
        msg += "\nRun `npx beli-mcp login` to sign in (opens a browser).";
      }
      return fail(msg);
    }
  };
}
