import { homedir } from "node:os";
import { join } from "node:path";

/** Runtime configuration resolved from environment variables. */
export interface Config {
  phone?: string;
  password?: string;
  sessionPath: string;
  draftsPath: string;
  /** When false, write tools require an explicit `confirm: true` argument. */
  allowWrites: boolean;
  /** Minimum ms between API calls (politeness throttle). */
  minIntervalMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dir = env.BELI_HOME ?? join(homedir(), ".beli");
  return {
    phone: env.BELI_PHONE,
    password: env.BELI_PASSWORD,
    sessionPath: env.BELI_SESSION_PATH ?? join(dir, "session.json"),
    draftsPath: env.BELI_DRAFTS_PATH ?? join(dir, "drafts.json"),
    allowWrites: env.BELI_ALLOW_WRITES === "1" || env.BELI_ALLOW_WRITES === "true",
    minIntervalMs: Number(env.BELI_MIN_INTERVAL_MS ?? "350"),
  };
}
