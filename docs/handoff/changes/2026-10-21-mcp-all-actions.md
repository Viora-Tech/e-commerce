# MCP: every admin action through search, describe and run

Branch `feat/mcp-all-actions`. Design: `docs/superpowers/specs/2026-10-21-mcp-all-actions-design.md`.
No migration.

- **Tools.** `searchActions`, `describeAction`, `runAction` (`packages/api/src/mcp/admin-actions.ts`)
  beside the curated assistant tools, always listed. Catalogue walked from `appRouter` at runtime;
  descriptions from JSDoc via `bun scripts/gen-mcp-action-docs.ts` →
  `packages/api/src/mcp/action-docs.generated.ts` (sweep `mcp-action-docs` fails when stale:
  rerun the script after changing a router's JSDoc).
- **Classification** in `packages/api/src/mcp/action-catalogue.ts` (read / write / sensitive /
  excluded, namespace → grant area). A new router namespace must be added to `NAMESPACE_AREA` or
  excluded, or `mcp-action-catalogue.test.ts` fails.
- **Grant areas** `marketing`, `online_store`, `settings` added to `API_AREAS`
  (`packages/core/src/api-access/client.ts`), with copy in `data/mcp.ts` and `data/hi/mcp.ts`.
- **Approvals.** New queued-only action `runAdminAction`
  (`services/ai/assistant/actions/admin-action.ts`); `ActionDefinition.permission` may be null for
  it; `actionFor()` in the registry; `ActionEnv.api` carries the approver's request so approving
  calls the procedure as them. `approveAction`/`reviseAction`/`cancelAction` use
  `APPROVE_PERMISSIONS` (any role). Card icon `SquareTerminal`.
- **Downloads.** `GET /api/mcp/[store]/download` (`handleMcpDownload`), signed 10-minute links;
  `principalForGrant` in core api-access.
- **`/api/v1`** refuses excluded paths and sensitive settings paths (`apiTokenRefusal`).
- `mcpHost()` now passes `api: apiHost` so MCP can call admin procedures.
- Copy: Settings → MCP & API says clients can use every admin action the role allows and that
  sensitive ones always need approval; "Can do" shows "Run X actions · needs approval" or
  "· sensitive ones need approval".
- Docs: developer docs "MCP server and API tokens", merchant guide "MCP & API".

Tests: `packages/api/test/mcp-action-catalogue.test.ts`, `packages/api/test/mcp-actions.test.ts`.

## Left to do

- Generic actions have no undo.
- The approval card text for generic actions is server-rendered English (as the curated ones are).
- Procedures built on bare `storeProcedure` (no permission) refuse tokens, so `runAction` answers
  them with that refusal; they are few (own appearance, dashboard tiles, `staff.me`).
