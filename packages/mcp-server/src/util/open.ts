import { spawn } from "node:child_process";

/**
 * Best-effort: open the user's default browser at `url`. Never throws — callers
 * must always also print the URL so headless/SSH users can open it manually.
 */
export function openBrowser(url: string): void {
  // Allow headless/CI/test usage to skip launching a browser.
  if (process.env.BELI_NO_BROWSER === "1" || process.env.BELI_NO_BROWSER === "true") {
    return;
  }
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else if (platform === "win32") {
      // `start` is a cmd builtin; the empty "" is the window title arg.
      spawn("cmd", ["/c", "start", "", url], {
        stdio: "ignore",
        detached: true,
      }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    /* ignore — URL is printed by the caller */
  }
}
