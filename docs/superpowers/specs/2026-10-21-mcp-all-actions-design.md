# MCP: every admin action through search, describe and run — design

Date: 2026-10-21. Owner: Kuldeep. Status: approved in chat (the store owner agreed to let the
store's MCP clients run every admin action under the rules below), written for implementation.

## Goal

Until now an MCP client saw only the AI assistant's ~10 read tools and ~6 typed proposals. The
owner wants a connected client (Claude, ChatGPT, Cursor, VS Code) to be able to do anything the
admin can do, as the member who connected it, without hand-writing a tool per procedure.

Rules the owner set:

1. Reads run immediately.
2. Everyday changes follow the store's existing "Changes need approval" switch.
3. Sensitive actions always wait for approval.
4. Sign-in and sessions, and creating MCP/API tokens, are never exposed.

## Shape

Three generic tools beside the existing curated ones (kept as they are):

- `searchActions({ query, area? })`: up to 20 matching admin procedures with path, one line,
  kind and area, limited to the areas the grant reaches.
- `describeAction({ path })`: input JSON Schema (Zod → JSON Schema), output hint, kind, and
  whether a call will wait for approval.
- `runAction({ path, input })`: runs it, or queues it.

The catalogue is the live oRPC router walked at runtime, so a new procedure needs no wiring.
Descriptions are the first sentence of each procedure's JSDoc, collected by a generator script
into a checked-in file (JSDoc is gone at runtime); a sweep keeps it fresh.

## Classification (`packages/api/src/mcp/action-catalogue.ts`)

Explicit tables win: excluded namespaces and paths, sensitive namespaces and paths, read paths.
Then: a name starting with `list/get/find/search/count/summary/stats/preview/quote/check/status`,
or a known read noun (`overview`, `label`, `pdf`, …) is a read; a name starting with
`delete/remove/cancel/refund/uninstall/disconnect/anonymise/revoke` is sensitive; everything else,
including unknown names, is a write. Two writes are sensitive by input: `orders.setStatus` to
`cancelled`, and `products.bulk` deleting.

Sensitive: refunds, store credit, cancellations, every delete and remove, gift card money,
payment gateway keys and settings, staff, roles and invitations, billing and plan, domains, store
export and deletion, MCP & API settings, sending a campaign.

Excluded: `account.*`, `me`, `onboarding.*`, `invitations.*` (cross-store), `bugReports.*`
(platform), creating or revoking tokens, approving/editing/cancelling/undoing AI actions (a client
must never approve itself), the AI bar itself, and browser hand-offs (Razorpay and Google
sign-in, media upload presign/confirm).

## Grants and roles

Each router namespace maps to one grant area. The seven existing areas could not cover settings,
themes or marketing, so three areas are added: `marketing`, `online_store`, `settings` (with the
permissions they unlock for calls that run at once). Reads need the area; anything else needs it
as write.

A call that runs at once goes through the admin's own middleware with `apiPrincipal` on the
context, exactly like `/api/v1`: the member's role ∩ the grant's areas decides, and the existing
`logTokenCall` writes the Activity row with the procedure path. Queued calls are approved by the
member who connected the client and run with that member's own request context, so the
procedure's middleware checks their role (no token cap: the approval is the person's decision).

## Approvals

A queued call is a new `ai_action` tool, `runAdminAction`, in the same AI approvals queue the
curated proposals use (`source: 'mcp'`). It is never offered as a tool of its own. The card shows
the action's human name, what it does, and every input value as a row, plus a note when it is
sensitive. Approve calls the procedure; a refusal (for example the approver's role) marks it
failed with the message. No undo. `approveAction`/`reviseAction`/`cancelAction` open to any
member with a role, still limited to their own proposals.

## Files, limits

A procedure that returns a `File` answers with a signed link (HMAC with the settings secret over
grant, store, path and input; 10 minutes) to `GET /api/mcp/<slug>/download`, which re-checks the
grant and re-runs the read. Input is capped at 32,000 characters, answers at 20,000 (cut with a
note), each call at 30 seconds.

## Access tokens

`/api/v1` has no approval step, so it now refuses excluded paths and sensitive paths in the
`settings` area. Existing tokens keep what they had; the new areas are opt-in.

## Not in scope

Undo for generic actions; per-procedure output schemas (none exist yet); translating the card
preview (server-rendered English, like the curated actions).
