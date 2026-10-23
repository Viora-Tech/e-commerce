# Automations engine (Shopify Flow equivalent): contract and core

Design: `docs/superpowers/specs/2026-10-23-automations-app-design.md` (owner answers: free app;
Starter 5 workflows / 2k runs, Growth 25 / 20k, Pro unlimited / 200k; HTTP and plugin actions
Growth+; Growth workflows never metered; cancel asks first, Owner-only to turn off; Growth works
without the app).

- **Core** `packages/core/src/automations/`: `definition.ts` (zod tree of condition / action /
  wait nodes; a condition's Then branch is `next`), `catalogue.ts` with `builtin-triggers.ts`,
  `builtin-actions.ts`, `condition-fields.ts`, `executor.ts` (action contract), `registry.ts`
  (pieces per store, publish check), `templates.ts`, `api-types.ts`, `app.ts` (the free
  `automations` app manifest), `merge-tags.ts`. Client-safe: `@commerce/core/automations`; server:
  `@commerce/core/automations/server`.
- **Engine** `engine/`: `trigger.ts` (idempotent runs per `(workflow, trigger_key)`, imported/test
  orders, COD and first order, loop guard depth 3, own-event skip, dedupe, circuit breaker, plan
  metering), `interpreter.ts` (one node per store transaction, approvals, retries with backoff,
  `onError`), `tick.ts` (due waits, lost runs, approval expiry, IST schedules), `dry-run.ts`,
  `workflows.ts` and `runs.ts` (router services), `jobs.ts` / `jobs-run.ts` (queues, handlers).
- **Seams for parallel work**: `conditions/index.ts` (`evaluateRules`, `loadSubjectData`) are
  stubs; executors go in `actions/**` and `actions/index.ts` (`order.add_tags` is the example).
- **DB**: migration `0156_automations` (journal entry last, newest `when`; `0157_fulfillment_hold` follows it) (workflow, version, run, step run, run record, secret,
  usage; `marketing_message.automation_run_id` / `automation_node_id`; `automations.*` grants;
  `stores_with_automation_work()`; Automations pre-installed on every existing store; `stores_with_old_automation_runs()` for the prune).
- **Wiring**: new outbox types (product created/updated, customer tags changed/subscribed,
  inventory low/out, `automation.app_trigger`) and `insertOutboxEvent(..., { cause })`; the relay
  queues `{automations}-trigger`; worker `apps/worker/src/automations.ts` (trigger, step, tick);
  `automations.*` router; `AppHookContext.triggerAutomation`; plugin manifest `automations` block;
  permissions `automations.read/write/publish/run`; `PLANS[x].automations`.
- **Pre-installed** (owner, 2026-10-23): marketing automations leave Growth for the Automations
  app, which every store has (`PREINSTALLED_APPS`, onboarding installs it). It cannot be
  uninstalled while Growth-origin workflows exist (`appUninstallBlocker`, apps router).
- **Events, owner alerts, prune, uninstall pause**: from `feat/automations-extras` (see
  `2026-10-23-automations-extras.md`).
- **External actions** run outside the run's transaction: the step is committed as in flight, the
  call is made (HTTP: `prepare` in a short tx, `send` with none), the result recorded in a short tx.
- **Integration** (one PR): engine + `feat/automations-actions` (executors, condition evaluator,
  fulfilment hold) + `feat/automations-ui` (admin app; dev mock removed) +
  `feat/automations-pages` (Run automation, record history, Growth cut-over) +
  `feat/automations-extras`. See their own notes: `2026-10-23-automations-actions.md`,
  `-admin-ui.md`, `-records-growth-cutover.md`, `-extras.md`.
- **Open**: messaging executors still call providers inside their own short transaction (only
  HTTP is fully two-phase); Find records / For each.
