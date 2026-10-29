# MCP proposals: the owner or a permitted member can approve; expired items say so

Branch `fix/mcp-owner-approve`, issue #955. No migration.

- **Who decides** (`openFor` in `packages/api/src/services/ai/assistant/service.ts`, replaces
  `ownOpen`): an assistant (AI bar) proposal is still the asker's alone. An MCP proposal
  (`source = 'mcp'`) may be approved or cancelled by the member who connected the client, the
  store owner, or a member whose role holds the action's permission. For `runAdminAction`
  (permission `null`) any member may try to approve and the admin procedure decides as them;
  editing or cancelling it for someone else is owner-only. The row is read `FOR UPDATE`
  (closes the double-approve note in `docs/security/audit-2026-10-06.md`).
- **Runs as the approver**, unchanged. New: when the admin procedure refuses with `FORBIDDEN`,
  `admin-action.ts` throws `ApproverNotAllowed` (`actions/resolve.ts`) and `approveAction`
  returns `FORBIDDEN` with the proposal left `proposed`, so someone who may can still approve
  it. Before, it was marked `failed`. `approvedBy` / `result.by` record the approver; cancel
  now records `result.by` too.
- **Expired**: views derive `expired` from `expiresAt` (`statusAt`), so `ai.action` and
  `ai.activity` show it at once; approving one is refused with "This request expired, so
  nothing was changed…". The MCP activity log (`listApiActivity` in
  `packages/core/src/api-access/service.ts`) returns `approvalStatus` and the admin shows
  "Expired before anyone approved it: nothing changed", "Approved", etc. on approval rows.
- **Who asked**: `ActionView.requestedBy` (member name, else email). `by` stays the
  approver/canceller (null until someone decides, which is why it was null on waiting rows).
  Shown on the card for MCP proposals ("Asked by …") and in Settings → AI → Activity
  ("asked by … · approved by …").
- Copy in `data/assistant.ts`, `data/mcp.ts` (+ `data/hi/`). Docs: merchant guide
  MCP & API and Ask AI, developer docs MCP & API.
- Tests in `packages/api/test/mcp-actions.test.ts`: owner approves a staff member's MCP
  proposal as the owner; staff without the permission is refused (approve and cancel) and the
  proposal keeps waiting; assistant cards stay the asker's; expired is refused and listed as
  expired.
