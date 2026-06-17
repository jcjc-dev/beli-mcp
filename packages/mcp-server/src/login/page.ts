/** Minimal, dependency-free HTML for the local login flow. */

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: grid; place-items: center; min-height: 100vh; margin: 0;
    background: #f6f7f9; color: #1b1b1f; }
  @media (prefers-color-scheme: dark) { body { background: #18181b; color: #f4f4f5; } }
  .card { width: 360px; max-width: 92vw; padding: 28px; border-radius: 14px;
    background: Canvas; box-shadow: 0 10px 40px rgba(0,0,0,.12); }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { margin: 0 0 18px; opacity: .65; font-size: 13px; }
  label { display: block; font-size: 12px; font-weight: 600; opacity: .8;
    margin: 14px 0 6px; }
  input { width: 100%; padding: 10px 12px; border-radius: 9px; font-size: 15px;
    border: 1px solid color-mix(in srgb, CanvasText 22%, transparent); background: Field; color: FieldText; }
  button { width: 100%; margin-top: 20px; padding: 11px; border: 0; border-radius: 9px;
    background: #ff5436; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:hover { background: #e6492f; }
  .err { margin-top: 14px; padding: 10px 12px; border-radius: 9px; font-size: 13px;
    background: #fdecea; color: #b3261e; }
  .ok { text-align: center; }
  .ok .check { font-size: 44px; }
  .muted { opacity: .6; font-size: 12px; margin-top: 8px; }
`;

const shell = (body: string): string =>
  `<!doctype html><html><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>Sign in to Beli</title><style>${STYLE}</style></head>` +
  `<body><div class="card">${body}</div></body></html>`;

export function loginPage(nonce: string, error?: string): string {
  const err = error ? `<div class="err">${escapeHtml(error)}</div>` : "";
  return shell(
    `<h1>Sign in to Beli</h1>` +
      `<p class="sub">Used once to get a token for <code>beli-mcp</code>. ` +
      `Your password is sent only to Beli and never stored.</p>` +
      `<form method="POST" action="/submit">` +
      `<input type="hidden" name="nonce" value="${escapeHtml(nonce)}">` +
      `<label for="phone">Phone number</label>` +
      `<input id="phone" name="phone" inputmode="tel" placeholder="+1XXXXXXXXXX" autofocus required>` +
      `<label for="password">Password</label>` +
      `<input id="password" name="password" type="password" required>` +
      `<button type="submit">Sign in</button>` +
      err +
      `</form>`,
  );
}

export function successPage(userLabel: string): string {
  return shell(
    `<div class="ok"><div class="check">✓</div>` +
      `<h1>Signed in</h1>` +
      `<p class="sub">${escapeHtml(userLabel)}</p>` +
      `<p class="muted">You can close this tab and return to your terminal.</p></div>`,
  );
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
