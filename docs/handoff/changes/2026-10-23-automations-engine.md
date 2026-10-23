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
- **DB**: migration `0149_automations` (workflow, version, run, step run, run record, secret,
  usage; `marketing_message.automation_run_id` / `automation_node_id`; `automations.*` grants;
  `stores_with_automation_work()`).
- **Wiring**: new outbox types (product created/updated, customer tags changed/subscribed,
  inventory low/out, `automation.app_trigger`) and `insertOutboxEvent(..., { cause })`; the relay
  queues `{automations}-trigger`; worker `apps/worker/src/automations.ts` (trigger, step, tick);
  `automations.*` router; `AppHookContext.triggerAutomation`; plugin manifest `automations` block;
  permissions `automations.read/write/publish/run`; `PLANS[x].automations`.
- **Open**: writers for the new outbox types, Growth migration and sweeps, owner emails at
  80%/100% usage and circuit breaker, retention prune job, admin UI.
