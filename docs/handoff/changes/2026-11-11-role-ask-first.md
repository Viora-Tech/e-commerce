# Role editor: one Off / Allowed / Ask first control; calculations never wait (#1525)

Branch `fix/role-approvals-3way`, PR into `dev`. No migration.

## The bug (#1525)

`orders.estimateDraftGst` was gated by `drafts.write` and its name has no read verb, so
`waitsForApproval` (packages/api/src/procedures/store.ts) treated it as a change. With Draft
orders: write on Ask first, the draft editor filled Approvals with "Orders: estimate draft gst".
The fix is in the classifier that layer already uses (`isReadPath`,
packages/api/src/mcp/action-catalogue.ts): `estimate` is now a read prefix, and the "Test
connection" procedures (payments, Decentro, Delhivery, storage, Chatwoot, GrowthBook, Umami,
Meilisearch, Shopify import) are in `READ_PATHS`. `checkDraftDiscount` was already a read.
`marketing.campaigns.testSend` and `payments.testOrderLink` stay writes (they send or create
something). This also makes these reads for MCP tokens.

Tests: `packages/api/test/mcp-action-catalogue.test.ts` (classification) and a role-approvals
case in `packages/api/test/mcp-actions.test.ts` (ticked drafts.write: estimate and check run,
saveDraft still queues).

## The role editor

- `components/staff/role-permissions.tsx` replaces `permission-switches.tsx` and
  `role-approvals-card.tsx`: one segmented control (ToggleGroup) per permission. Reads and
  `approvals.manage` (`canNeedApproval` false) show only Off / Allowed; the owner role has no
  Ask first.
- The rules are pure in `components/staff/role-access.ts` (tested in `role-access.test.ts`):
  an action on turns Read on, Read off turns the resource off, Select all keeps ticks. Only the
  owner changes Ask first; for others the ticks stay as saved and rows show them.
- `role-editor.tsx`: one Save in the PageHeader calls `staff.saveRole` (when name, description
  or grants changed, or the role is new) and then `staff.saveRoleApprovals` (owner only, when
  the ticks changed or the role is new). Both endpoints keep their own server checks; no new
  endpoint. Built-in roles keep their grants but the owner can still set Ask first on them (the
  Admin role is where the owner needs it). A new role starts showing the server's default ticks.
- Copy: `data/staff.ts` `roleForm` (+ Hindi). The approvals `role` copy is gone.

## Settings › Staff

`staff-settings.tsx`: inside a row the PageHeader names it ("Roles"), its back link leads to
Staff, and the row's action sits in the header (Create role on Roles, Invite member elsewhere).
`SettingsDrill` takes `backRow={false}` so there is no second back row.

Docs: merchant guide `settings/staff.mdx` (section "Off, Allowed and Ask first") and the link in
`settings/mcp-and-api.mdx`.
