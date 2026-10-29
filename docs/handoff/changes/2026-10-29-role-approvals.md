# Role-based approvals replace the MCP "Changes need approval" switch

Refs #955. Migration `0188_role_approvals`.

- MCP clients and API tokens act with exactly the connecting member's role (∩ the grant's
  areas). The store-wide "Changes need approval" MCP switch is gone (`requireApproval` removed
  from `McpSettingsSchema`; the migration strips it from `store.preferences.mcp`). Curated MCP
  proposal tools run at once; the AI bar's own propose → Approve cards are unchanged.
- New `role_approval` table: per-role "Needs approval" ticks on change permissions. Owner-only
  editing (`staff.saveRoleApprovals`), shown as a card in the role editor. Defaults
  (`DEFAULT_APPROVAL_PERMISSIONS`) for every non-owner role: orders.refund, orders.cancel,
  products.delete, customers.delete, discounts.write, payments.manage, staff.invite,
  staff.manage, billing.manage. settings.manage is not ticked.
- New permissions: `payments.manage` (payment gateway keys, modes, Razorpay OAuth,
  `store.updatePayments`; granted to every role holding settings.manage) and `approvals.manage`
  (seeded for the built-in Administrator).
- One queue point: `storeProcedureWith` in `packages/api/src/procedures/store.ts`. A ticked
  `can(permission)` call that the catalogue classifies as write/sensitive (`approvalKind`) is
  stored as a `runAdminAction` `ai_action` row (`needs_approver`, `permission`, source
  `admin`/`mcp`/`api`, 7-day expiry) and refused with `APPROVAL_QUEUED`. The admin API client
  turns that into "Sent for approval" for every page; MCP answers "Waiting for approval".
- Approver rules (`procedures/approval-rules.ts`): owner always; otherwise a different member
  with approvals.manage who holds the permission and whose role does not tick it. The asker may
  only withdraw. Approving replays as the approver (`approvalReplay`).
- Safety floor unchanged: sensitive MCP actions always wait for a human click, even for the
  owner. The connecting member may confirm their own client's sensitive action; recorded as
  `result.confirmedAi`.
- Settings → Approvals page (waiting for you, your requests with outcomes, expired marked;
  Reject left, Approve right) with a nav count for waiting items and unseen outcomes.

Gaps (documented in developer docs "MCP & API" → "Role approvals"): reads, `canAny` and
`canDetached` procedures, and server-side `call()`s without a path are never queued; people-only
paths (hand-offs, tokens, deciding approvals) and file uploads with a ticked permission are
refused rather than queued. `payments.skipSetup` / `testOrderLink` stay on settings.manage.

Tests: `packages/api/test/mcp-actions.test.ts` ("role approvals").
