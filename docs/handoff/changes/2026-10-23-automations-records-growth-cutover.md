# Automations: Run automation on records, history cards, Growth onto the engine

Branch `feat/automations-pages` (from the contract commit `2a503b6f`). Design:
`docs/superpowers/specs/2026-10-23-automations-app-design.md` §9.3, §9.4, §10.

## Records (Phase 3 UI)

- `apps/admin/src/components/automations/records/`: `RunAutomationDialog` (On workflows with the
  record type's manual trigger: search, actions, approvals, last run; `automations.runNow` with a
  client request id, ≤ 250 records), `useRunAutomation` (menu items, gated on the app being
  installed and `automations.run` / `.read`), `RunAutomationButton` (bulk bars without a menu),
  `AutomationHistoryCard` (`automations.history`, links to `/apps/automations/runs/<id>` and
  `/apps/automations/runs?recordType=&recordId=`).
- Wired: order, customer, product More actions (Run automation, Automation runs); Orders bulk
  More actions; Customers and Products bulk bars. History: `ADMIN_APPS.automations.OrderCard` /
  `CustomerCard`, `PRODUCT_APP_SECTIONS.automations` (product More tab).
- Copy `data/automation-records.ts` + `data/hi/automation-records.ts`.
- Contract: `ManualWorkflow.lastRunAt` added (api-types.ts).

## Growth on the engine (Phase 1)

- `packages/core/src/marketing/automation-engine-map.ts`: pure mapping of a `marketing_automation`
  to a straight-line `WorkflowDefinition` (node ids = step ids, conditions = "continue only if",
  messages `onError: 'continue'`, `exitOnOrder` from `STOPS_ON_ORDER`) and of runs (same id, open
  runs `waiting` on the step after their wait, subject per trigger).
- `automation-cutover.ts`: flag `store.preferences.automationsEngine` (`legacy` | `engine`);
  `legacyOwnsStore` takes a share lock on the store row, the cutover takes it `FOR UPDATE`, so no
  legacy write lands after the copy. `cutoverStoreToEngine` (one transaction, idempotent) copies
  workflows + version 1, runs (all statuses, `metered=false`), run records, links
  `marketing_message.automation_run_id/automation_node_id`, flips the flag. `verifyCutover`
  compares runs / open / converted / next due per automation.
- Legacy runner (`automations.ts`): `enrolDue`, `processDueRuns` no-op on engine stores;
  `onOrderPlaced` credits the order to engine runs (`markEngineConversions`); `enrolSubscriber`
  writes outbox `customer.subscribed`.
- `growth-engine.ts`: `growthSweep` (abandoned checkout/cart, lapsed; old rules and keys) through a
  `start` callback = the engine's `startRuns`; `growthExitCheck` = `EngineDeps.exitCheck`.
  No imports from `automations/engine/**`.
- `growth-automations.ts`: Growth's list/get/create/update/setStatus/delete read and write the
  engine for cut-over stores (same shapes, plus `editable` / `engine`); the marketing router uses
  it. Click credit (`tracking.ts`) and Growth outcome names resolve engine workflows.
- `scripts/migrate-marketing-automations.ts`: dry run by default, `--store` / `--all`,
  `--apply` per explicit store; rolls a store back if verify fails. **Not run on any database.**

## Tests

`automation-engine-map.test.ts`, `automation-cutover.test.ts`, `growth-engine.test.ts` pass.
`growth-parity.test.ts` skips until the engine is in the tree; on a local merge with
`feat/automations` + `feat/automations-actions` (2026-10-23) 2 of 8 timelines passed. Open, reported
to their owners: cart block, recipient mismatch and COD transactional in the message executors;
`customer.subscribed` key per customer and Off Growth workflows holding waiting runs in the engine.

## Left to wire once the engine lands

Worker: `EngineDeps.exitCheck = growthExitCheck` and `growthSweep(..., startRuns)` in the
automation tick.

After a store's cutover, `/growth/automations` redirects to `/apps/automations?origin=growth`
(the Marketing filter; the app's list reads `origin`), and `/growth/automations/<id>` to
`/apps/automations/workflows/<id>` (ids are kept). The check is `marketing.automations.mode`.
Before cutover the old Growth editor is unchanged. No read-only Growth editor (owner decision).
