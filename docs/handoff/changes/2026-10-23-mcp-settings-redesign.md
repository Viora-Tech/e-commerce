# Settings → MCP & API redesign

- One page instead of three tabs: status (connected count, last request, MCP URL), "Connect an AI
  app" guide (Claude, Claude Code, ChatGPT, Cursor, VS Code, other MCP apps; commands and configs
  built from the real MCP URL), Connected AI apps, Permissions & approvals, API tokens, and a link
  to the activity log, now its own page at `/settings/mcp/activity`.
- Connected AI apps lists every OAuth sign-in plus every API token that has been used, with
  Disconnect / Revoke behind a confirm dialog. The old page only showed OAuth grants, on a second
  tab, and the overview only lit up the four brand cards.
- Connections live per admin address: an app connected to the live admin (`admin.koomerce.app`)
  never shows on a local dev server's page, which reads the local database.
- The token-created dialog shows the `Authorization: Bearer` header and the Claude Code command
  with the real token.
- Merchant guide "MCP & API" rewritten to match.
