import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { BeliClient } from "@beli/client";
import { FileSessionStore } from "../auth.js";
import type { Config } from "../config.js";
import { openBrowser } from "../util/open.js";
import { loginPage, successPage } from "./page.js";

export interface LoginResult {
  userId: string | null;
}

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const HOST = "127.0.0.1";

/**
 * Spin up a one-shot localhost login page. The user enters phone + password in
 * their browser; we validate against Beli before persisting ONLY the tokens.
 * Client-agnostic (works for Claude Desktop, Cursor, CLI, etc.) — no env vars.
 *
 * Hardening: binds to loopback on an ephemeral port; a random nonce (only ever
 * placed in the opened URL) is required on GET and POST; the Host header must
 * match our own origin (anti DNS-rebinding); auto-exits after a timeout.
 */
export function runInteractiveLogin(config: Config): Promise<LoginResult> {
  return new Promise<LoginResult>((resolve, reject) => {
    const nonce = randomBytes(24).toString("base64url");
    const client = new BeliClient({ store: new FileSessionStore(config.sessionPath) });

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      fn();
    };

    const server = createServer((req, res) => {
      handle(req, res).catch((err) => {
        sendHtml(res, 500, loginPage(nonce, String(err?.message ?? err)));
      });
    });

    const expectedHostFor = (port: number) => `${HOST}:${port}`;

    async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
      const port = (server.address() as AddressInfo).port;
      const url = new URL(req.url ?? "/", `http://${expectedHostFor(port)}`);

      // Anti DNS-rebinding: only accept requests addressed to our loopback origin.
      if (req.headers.host !== expectedHostFor(port)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      if (url.pathname === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }

      if (req.method === "GET" && url.pathname === "/") {
        if (url.searchParams.get("nonce") !== nonce) {
          res.writeHead(403).end("forbidden");
          return;
        }
        sendHtml(res, 200, loginPage(nonce));
        return;
      }

      if (req.method === "POST" && url.pathname === "/submit") {
        // Defense-in-depth (the nonce is the primary CSRF defense): reject any
        // cross-origin submission that a browser labels for us.
        const origin = req.headers.origin;
        const fetchSite = req.headers["sec-fetch-site"];
        if (
          (origin && origin !== `http://${expectedHostFor(port)}`) ||
          (fetchSite && fetchSite !== "same-origin")
        ) {
          res.writeHead(403).end("forbidden");
          return;
        }
        const form = await readForm(req);
        if (form.get("nonce") !== nonce) {
          res.writeHead(403).end("forbidden");
          return;
        }
        // Normalize obvious separators; keep '+' and digits (E.164).
        const phone = (form.get("phone") ?? "").replace(/[\s()-]/g, "");
        const password = form.get("password") ?? "";
        if (!phone || !password) {
          sendHtml(res, 400, loginPage(nonce, "Phone and password are required."));
          return;
        }
        // We're committing to a login attempt: disarm the idle timeout so it
        // can't reject mid-request (which would desync the CLI from disk).
        clearTimeout(timer);
        try {
          await client.init();
          await client.login({ phone, password }); // validates + persists tokens
        } catch (err) {
          const status = (err as { status?: number })?.status;
          const msg =
            status === 401 || status === 400
              ? "Invalid phone or password. Use international format, e.g. +15551234567."
              : `Login failed: ${(err as Error).message}`;
          // Re-arm the idle timeout so the user still gets a retry window.
          timer = setTimeout(onTimeout, LOGIN_TIMEOUT_MS);
          sendHtml(res, 401, loginPage(nonce, msg));
          return;
        }
        const label = client.userId ? `Logged in as ${client.userId}` : "Logged in";
        sendHtml(res, 200, successPage(label));
        // let the response flush before tearing down the server
        setTimeout(() => finish(() => resolve({ userId: client.userId })), 250);
        return;
      }

      res.writeHead(404).end("not found");
    }

    const onTimeout = () =>
      finish(() =>
        reject(new Error("login timed out (no submission within 5 minutes)")),
      );
    let timer = setTimeout(onTimeout, LOGIN_TIMEOUT_MS);

    server.on("error", (err) => finish(() => reject(err)));
    server.listen(0, HOST, () => {
      const port = (server.address() as AddressInfo).port;
      const loginUrl = `http://${HOST}:${port}/?nonce=${nonce}`;
      process.stderr.write(`\nOpening your browser to sign in to Beli…\n`);
      process.stderr.write(`If it doesn't open, visit:\n  ${loginUrl}\n\n`);
      openBrowser(loginUrl);
    });
  });
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) throw new Error("request body too large");
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}
