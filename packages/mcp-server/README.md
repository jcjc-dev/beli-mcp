# beli-mcp

[![npm version](https://img.shields.io/npm/v/beli-mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/beli-mcp)
[![MIT License](https://img.shields.io/npm/l/beli-mcp?color=blue)](./LICENSE)
[![Model Context Protocol](https://img.shields.io/badge/MCP-server-6E56CF)](https://modelcontextprotocol.io)

An [MCP](https://modelcontextprotocol.io) server for [Beli](https://beliapp.com).
**Log in once**, then search places, rank reviews, manage photos, and bookmark
places from any MCP client (Claude Desktop, Cursor, VS Code, etc.).

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=beli&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImJlbGktbWNwIl19)
[![Install in VS Code](https://img.shields.io/badge/Install%20in%20VS%20Code-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22beli%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22beli-mcp%22%5D%7D)

> Unofficial. Built on a reverse-engineered private API (app v9.3.1); Beli makes
> no compatibility guarantee. Use with your own account and rate-limit politely.

## Install / run

No install needed — run it with `npx`:

```bash
npx beli-mcp
```

### Claude Desktop / Cursor config

```jsonc
{
  "mcpServers": {
    "beli": {
      "command": "npx",
      "args": ["-y", "beli-mcp"]
    }
  }
}
```

On **Windows**, wrap the command with `cmd /c`:

```jsonc
{
  "mcpServers": {
    "beli": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "beli-mcp"]
    }
  }
}
```

No credentials go in the config — authenticate once with `npx beli-mcp login`
(below). Login is by **phone number** (E.164), not email.

## Log in once

`beli-mcp` authenticates with a **one-time browser login** — no credentials in
any client config, works the same for every MCP client:

```bash
npx beli-mcp login
```

This opens a small **localhost** page in your browser, you enter your Beli phone
+ password, and it's validated against Beli before the session is saved. Only
**tokens** are persisted (to `~/.beli/session.json`, mode 0600) — your password
is never stored. A single login lasts ~7 days (the refresh token lifetime); the
20-minute access token is refreshed automatically.

```bash
npx beli-mcp whoami    # show the saved user id
npx beli-mcp logout    # clear the saved session
```

> `logout` clears the local session file only. It does not revoke the tokens
> server-side — the refresh token remains valid on Beli until it expires (~7
> days). Don't share the session file.

The login server binds to loopback only, uses an ephemeral port + a one-time
nonce, rejects forged `Host` headers (anti DNS-rebinding), and exits after you
sign in (or after 5 minutes).

Once logged in, point any MCP client at the server with no secrets in its config:

```jsonc
{
  "mcpServers": {
    "beli": { "command": "npx", "args": ["-y", "beli-mcp"] }
  }
}
```

### Headless / CI

For non-interactive environments, set `BELI_PHONE` + `BELI_PASSWORD` and
`beli-mcp login` will authenticate without opening a browser. Set
`BELI_NO_BROWSER=1` to never attempt to launch a browser.

### VS Code (secure prompt, no hardcoding)

VS Code can prompt for credentials and store them in its secret storage via
input variables, then run a one-time headless login:

```jsonc
// .vscode/mcp.json
{
  "inputs": [
    { "id": "beli-phone", "type": "promptString", "description": "Beli phone (+1…)" },
    { "id": "beli-password", "type": "promptString", "description": "Beli password", "password": true }
  ],
  "servers": {
    "beli": {
      "command": "npx",
      "args": ["-y", "beli-mcp"],
      "env": { "BELI_PHONE": "${input:beli-phone}", "BELI_PASSWORD": "${input:beli-password}" }
    }
  }
}
```

Login is by **phone number** (E.164), not email.

## Tools

| Tool | Kind | Description |
|------|------|-------------|
| `search_places` | read | Place typeahead near a location (Google Places). |
| `find_business` | read | Resolve a name+location to a Beli `business_id`. |
| `business_detail` | read | Full business details by id. |
| `get_been` | read | A user's ranked "Been" list. |
| `get_want_to_try` | read | A user's "Want to Try" bookmarks. |
| `rank_place` | **write** | Create a ranked review (score is computed by Beli). |
| `upload_photo` | **write** | Upload a photo for a business from a local file. |
| `list_photos` | read | List your photos for a business. |
| `delete_photo` | **write** | Soft-delete a photo. |
| `bookmark` / `unbookmark` | **write** | Add/remove from "Want to Try". |
| `draft_*` | local | Compose a review offline and `draft_submit` it atomically. |

## Write safety

Write tools mutate your real account. By default they are **gated**: either start
the server with `BELI_ALLOW_WRITES=1`, or pass `confirm: true` on each write call.

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `BELI_PHONE` | – | E.164 phone (headless/CI login only) |
| `BELI_PASSWORD` | – | account password (headless/CI login only; never stored) |
| `BELI_NO_BROWSER` | `0` | set `1` to never launch a browser during login |
| `BELI_ALLOW_WRITES` | `0` | set `1` to allow writes without per-call confirm |
| `BELI_HOME` | `~/.beli` | base dir for session + drafts |
| `BELI_SESSION_PATH` | `$BELI_HOME/session.json` | session file path |
| `BELI_MIN_INTERVAL_MS` | `350` | politeness throttle between API calls |

## License

MIT
