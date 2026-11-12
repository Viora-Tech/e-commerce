# Hono preview token is people-only in the MCP catalogue (12 Nov 2026)

`honoPreview.token` (#1622) had no MCP & API area, so `mcp-action-catalogue.test.ts` failed on dev. It is a browser hand-off for the store owner, so it is listed with the other people-only paths and never offered to MCP or API clients.
