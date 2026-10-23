# Automations app (Shopify Flow equivalent): design

Date: 2026-10-23. Status: draft for owner review. Read against `origin/dev` at `f5ecfef6` (PR #682, App Store site, merged).

## 1. Intent

Merchants do the same small chores on every order, customer and product: tag the VIPs, hold the risky COD orders, ping the packer on WhatsApp, add new arrivals to a collection. Shopify merchants do this with Shopify Flow. Koomerce needs the same thing so a store moving over keeps its automations and stops doing chores by hand.

The owner decided (2026-10-22/23):

- **Automations** is a built-in Koomerce app. It is installed from the App Store website and shows in Installed apps. It is a general engine for the whole store: trigger, conditions, actions.
- Every detail page gets **Run automation** under More actions, every list gets it as a bulk action, and every record shows its **automation history**.
- Growth's six marketing automations become **templates on the new engine**. Growth → Automations stays in Growth, backed by the engine. Existing automations and their in-flight runs must keep working.
- Plugins, including the Meta, Google and Shopify integrations another agent is building now, must be able to **contribute triggers and actions** the way Shopify Flow connectors do.

## 2. Goals

1. One engine runs every automation: the general ones built in the Automations app and Growth's marketing ones.
2. Triggers come from the existing outbox (`packages/core/src/outbox`), from sweeps (abandoned baskets, lapsed customers), from schedules and from a member's "Run automation". Plugins can add more.
3. Conditions compare typed fields on the order, customer, product or line items with AND/OR, for example "total > ₹2,000 AND shipping state = Maharashtra AND customer tags contain VIP".
4. Actions: add or remove a tag, add a note, hold, release, cancel or fulfil an order, add a product to a collection, set a metafield, alert staff by email or WhatsApp, send the customer a message, call an HTTP webhook, wait. Plugins can add more.
5. Every run is visible: a run log with each step's input, output and error, retry and cancel, and a per-record history.
6. Safety: actions that cancel, fulfil or message customers are clearly marked. Cancel waits for approval by default. Any workflow can be dry-run against a real record first. Automation loops cannot run away.
7. Growth's six templates, their stats (sent, opened, clicked, orders, revenue) and every running sequence carry over with no double sends and no lost runs.

## 3. Non-goals (this design)

- Refunds as an automation action. Refunds move money, and the owner's list didn't include them. Add later behind approval.
- Custom code steps (Shopify's "Run code"). Untrusted JS in a multi-tenant worker needs a sandbox. Not now.
- A Shopify-style "Send Admin API request" action. The HTTP action plus plugin actions cover the need.
- Third-party (outside-company) connector apps. The plugin contract is designed so they can come later, but only our own plugins ship connectors now.
- A visual email designer inside the Automations editor. Marketing email and WhatsApp steps keep Growth's editor (section 9.4).
- Moving outbox delivery onto a new queue system.
- Importing a store's existing Shopify Flow workflows. Flow exports aren't reachable through Shopify's Admin API, so the Shopify import can't read them. Merchants rebuild from our templates. The schema stays open to add a `forEach` node kind (Phase 5) so a later importer has somewhere to land. (Builder check, my call.)

## 4. Anti-goals (must not happen)

- **No double send and no lost run** during the Growth migration. A shopper in the middle of an abandoned-checkout sequence gets exactly the messages they would have got.
- **No automation storm.** One automation's change must not trigger another (or itself) without limit, and one store's flood must not slow other stores.
- **No marketing without consent.** The consent and recipient rules in `marketing/send.ts`, `privacy/client.ts` and `marketing/recipient.ts` stay the only path for customer messages.
- **No silent dangerous change.** An automation never cancels an order or messages a customer without that being visible on the workflow, in the run log and on the record's timeline.
- **No automations from imported or test data.** Imported orders never trigger (today's rule). Orders paid on a gateway's test keys stay out by default (Payments Live/Test, PR #608).
- **No second app list, permission list or queue framework.** Reuse `@commerce/core/app-catalogue`, `permissions/statement.ts`, `@commerce/queue` (BullMQ plus `fairProcessor`) and the outbox.

## 5. Constraints (from the codebase)

- Bun monorepo, Next.js 16 admin, React 19 with the React Compiler (no manual memoisation), oRPC routers guarded by `can(permissions.X)`, Drizzle/Postgres with forced RLS on every tenant table (`withStore`), BullMQ worker in `apps/worker`.
- **Outbox** (`packages/core/src/outbox`): writers call `insertOutboxEvent(tx, …)` in the same transaction as the change. The relay (`relay.ts → dispatchRow`) fans each row out to notifications and app hooks, keyed by row id so a re-dispatch never double-enqueues. Event names: `order.placed|paid|fulfilled|cancelled|delivered|rto`, `refund.created`, `return.requested|approved|rejected|received|refunded`, `inventory.restocked`, `shipment.*`, `catalog.products_changed` (ids only, no created/updated split), `customer.created|updated`, and others. There is **no** event yet for product created or updated, stock low or out, customer tag change, or checkout abandoned.
- **Current automations** (`packages/core/src/marketing/automation-steps.ts`, `automations.ts`, `apps/worker/src/marketing.ts`): tables `marketing_automation` (trigger, linear `steps` jsonb of wait/email/whatsapp/condition, settings), `marketing_automation_run` (unique `(automation_id, trigger_key)`, `step_index`, `next_at`, status active/completed/converted/stopped) and `marketing_message` (unique per run step, so a retried step never sends twice). A 30-second `{marketing}-tick` enrols from sweeps (`enrolDue`) and advances due runs (`processDueRuns`, 50 per tick, `FOR UPDATE SKIP LOCKED`). Event enrolment comes from `onOrderPlaced` and `enrolSubscriber`. Business rules to keep: `STOPS_ON_ORDER` conversion and a 14-day attribution window, `isTransactionalStep` (the COD confirmation needs no consent), the unsubscribe stop, the recipient-mismatch skip, the 7-day abandoned lookback, the imported-order exclusion, and the legacy `cart.recoverySentAt` flag.
- **Admin today**: Growth → Automations has a linear flow editor (`components/growth/automations/automation-flow*.tsx`, palette, step cards, a test panel with made-up shoppers in `lib/automation-test-run.ts`).
- **Plugins** (`packages/plugins/src/types.ts`): `PluginManifest` has `kind`, `hooks` (AppEvent: order.paid/fulfilled/delivered, refund.created, customer.created/updated), `jobs`, `admin` (`pages`, `orderActions` with targets `detail|row|bulk`, `orderDetailCard`, `customerDetailCard`), `access` (resources and levels), and `listing`. `catalogue.generated.ts` is generated from the manifests. App pricing lives in `billing/apps.ts`, and an app not listed there is free.
- **Approvals**: `ai_action` (`packages/db/src/ai-schema.ts`) is the audit log and approval queue for AI and MCP changes (proposed → executed/failed/cancelled/expired/undone), shown in Settings → AI → Activity. The MCP rules the owner approved: reads run at once, writes follow "Changes need approval", sensitive actions (refunds, cancellations, deletes…) always wait for approval.
- **Permissions**: `statement.ts` is the single source. Orders already has `cancel` and `fulfil`, and marketing has `send`. There is no automations resource yet.
- **Plans** (`billing/plans.ts`): starter / growth / pro, with per-plan numbers in one place.
- `CLAUDE.md`: check the OSS radar first, credit adapted code in `THIRD_PARTY_NOTICES.md`, put copy in `data/<feature>.ts` with a Hindi overlay, record each change in `docs/handoff/changes/`.

## 6. Prior art: Shopify Flow (2026)

From help.shopify.com and shopify.dev, read 2026-10-23:

- A workflow is one **trigger**, then **conditions** (then/otherwise branches, AND/OR, "any/all" over lists such as line items) and **actions**. It also has **Wait**, **Get data** (a query, up to 100 items), **For each** loops and **scheduled time** triggers (as often as every 10 minutes).
- **Run history**: statuses In progress, Waiting, Rate limited, Canceled, Completed (plus failed actions within a run). The run detail draws the path taken over the workflow diagram, with each step's data and errors and each loop iteration's result. Runs can be retried (shown as "Manual retry") and cancelled. Turning off a workflow cancels its in-progress runs. Runs are kept **14 days**.
- **Version history** (kept 1 year), and **templates** in a library you copy and edit.
- **HTTP request action**: any method, headers and body, store-level **secrets** (`{{secrets.handle}}`, redacted in logs), a 30-second timeout, and a per-action choice on 4xx/5xx/429 of Retry (up to 24 h), Fail or Ignore. The response body can feed later steps. Paid plans only.
- **Connectors** (apps): apps contribute triggers (they send the event with a payload), actions (Flow POSTs `{action_run_id, handle, properties}` to the app, signed with HMAC, with a 10 s timeout; 202/429/5xx are retried up to 36 h and other 4xx fail) and templates. `action_run_id` is the idempotency key. Apps can't add conditions.
- "Run Flow automation" on a record and in bulk is a dedicated manual trigger per resource ("Order/Customer/Product action triggered").

What we take: the same shapes, words and limits merchants already know, the connector contract (idempotency key, retry codes) and 14-day run detail with longer summary history (section 8.6).

## 7. Build vs adopt

The radar (`docs/open-source-radar.md`) and a fresh licence check, 2026-10-23:

| Candidate | Licence | What it is | Verdict |
|---|---|---|---|
| Activepieces | MIT outside `packages/ee`, `app/ee` | Whole product (Fastify, own DB and queue, its own users). Pieces = trigger/action definitions with property schemas. | **Adopt the model, not the runtime.** It can't run inside our RLS tenancy, and running it alongside means a second auth, DB and worker. Copy the piece/property definition shape and the builder's layout ideas. Credit it if any code is adapted. |
| DBOS Transact (TS) | MIT | Library for durable workflows on Postgres. | Reject. It needs its own system database or schema and a second durability layer next to BullMQ, and it knows nothing about per-store RLS or `fairProcessor`. Our runs are short interpreted graphs, not code workflows. |
| Temporal, Trigger.dev, Hatchet | MIT, Apache-2.0, MIT | Separate orchestration servers. | Reject for infra. The outbox already follows the Temporal/Trigger.dev pattern (noted in `write.ts`). |
| Dittofeed | MIT | Marketing journeys and segments. | Ideas for marketing exit/goal rules only. |
| n8n | Sustainable Use (not OSI) | Workflow tool. | Ideas only (the radar says so). |
| Inngest | Server under SSPL/source-available | Event-driven functions. | Not licence-compatible to embed. |

**Recommendation: build.** It is a small interpreter (trigger, tree of condition/action/wait nodes) on our outbox, BullMQ, `fairProcessor` and Postgres tables, with the Shopify Flow UX and connector contract and Activepieces' piece/property shape (MIT, credited). The hard parts (multi-tenant RLS, consent rules, per-store fairness, approvals) are ours either way, and no candidate solves them.

## 8. Decided design

### 8.1 Concepts and words (merchant-facing)

- **Workflow**: a trigger plus steps. On or Off. Has versions.
- **Trigger**: what starts it ("Order paid").
- **Condition**: a check with **Then** and **Otherwise** branches.
- **Action**: does something ("Add order tags").
- **Wait**: pause for a time.
- **Run**: one trip through a workflow for one subject (one order, customer, product, or none for a schedule).
- **Template**: a prefilled workflow to copy.

### 8.2 Workflow definition (stored JSON, validated by zod in `@commerce/core/automations`, pure and client-safe)

```ts
type WorkflowDefinition = {
  trigger: { type: TriggerId; config: Record<string, unknown> }  // e.g. { type: 'order.paid', config: { includeTest: false } }
  start: NodeId | null
  nodes: Record<NodeId, Node>
  settings: {
    /** Marketing: end the run when the subject's customer places an order (today's STOPS_ON_ORDER). */
    exitOnOrder?: boolean
    /** Same subject, same workflow: no second run within N minutes (0 = no limit). */
    dedupeMinutes?: number
  }
}
type Node =
  | { kind: 'condition'; id; rules: RuleGroup; then: NodeId | null; otherwise: NodeId | null }
  | { kind: 'action'; id; action: ActionId; config: Record<string, unknown>; next: NodeId | null;
      onError: 'stop' | 'continue'; needsApproval?: boolean }
  | { kind: 'wait'; id; minutes: number; next: NodeId | null }              // 1 min – 60 days, as today
type RuleGroup = { join: 'and' | 'or'; rules: (Rule | RuleGroup)[] }        // nesting depth ≤ 2
type Rule = { field: FieldPath; op: Operator; value: unknown;
              quantifier?: 'any' | 'all' | 'none' }                          // for list fields (line items, tags)
```

- The graph is a **tree**: branches never merge again, as in Flow. That keeps the run path and the editor simple. At most **50 nodes**.
- `TriggerId` and `ActionId` are strings from a **registry** (8.4). Built-ins are bare (`order.paid`). Plugin ones are namespaced `<pluginId>/<name>`.
- **Fields** come from a typed subject schema per resource, declared next to each trigger: order (number, total, subtotal, discount codes, payment method, financial and fulfilment status, is COD, shipping state/city/pincode, tags, channel, line items[] {product, SKU, quantity, price, product tags, product type}, customer {…}), customer (tags, order count, total spent, email/WhatsApp consent, state, created at), product (status, tags, type, vendor, price, total stock, collections). Operators by type: number `= ≠ > ≥ < ≤`; text `is, is not, contains, starts with, is empty`; list `includes, doesn't include` with any/all/none; boolean; date `before, after, in the last N days`; enum `is one of`. Money is entered in rupees and stored in paise.
- **Merge tags** in text fields reuse today's single-brace `applyMergeTags`, extended with dotted paths (`{order.number}`, `{customer.first_name}`). There's no template logic. Unknown tags render empty and the editor flags them.

### 8.3 Data model (new tenant tables, forced RLS, `packages/db/src/automation-schema.ts`)

- `automation_workflow`: id, store_id, name, description, `status` ('on' | 'off'), `origin` ('automations' | 'growth'), `template_id`, `trigger_type` (denormalised for lookup), `published_version_id`, `draft_definition` jsonb (unsaved edits), `next_fire_at` (schedules), `problem` text (why it was switched off automatically), created_by, created_at, updated_at. Index `(store_id, trigger_type, status)`.
- `automation_version`: id, store_id, workflow_id, `number`, `definition` jsonb (immutable once written), published_by, published_at. A run pins the version it started on, so editing a live workflow never changes a run in progress. Waiting runs finish on their old version.
- `automation_run`: id, store_id, workflow_id, version_id, `trigger_type`, `trigger_key` (**unique `(workflow_id, trigger_key)`**, the idempotency key: `outbox:<rowId>`, `cart:<cartId>`, `lapsed:<orderId>`, `manual:<requestId>:<recordId>`, `schedule:<fireAt>`), `subject_type` ('order' | 'customer' | 'product' | 'cart' | 'none' | plugin type), `subject_id`, `status` (queued, running, waiting, awaiting_approval, completed, failed, cancelled, skipped, converted, stopped), `cursor` (the node to run next), `next_at`, `depth` (loop guard, 8.5), `caused_by_run_id`, `is_test` (dry runs are never stored as runs, see 8.7; this marks runs on test-mode orders when a merchant opts in), `trigger_data` jsonb (the event payload snapshot, minimal: ids plus what conditions need at trigger time), marketing columns kept from today (customer_id, cart_id, order_id, email, phone, name, `converted_order_id`, `stop_reason`), started_at, finished_at, `error`. Indexes: due `(store_id, status, next_at)`, subject `(store_id, subject_type, subject_id, started_at desc)`, workflow `(workflow_id, started_at desc)`.
- `automation_step_run`: id, store_id, run_id, node_id, `iteration` (0 for now, reserved for For each), `attempt`, `status` (succeeded, failed, skipped, then, otherwise, waiting, awaiting_approval, cancelled), `input` jsonb (the resolved config, secrets redacted), `output` jsonb (e.g. tags added, HTTP status and a truncated body of at most 8 KB), `error`, started_at, finished_at. **Unique `(run_id, node_id, iteration)`**, so a re-executed step finds its row (same idea as `marketing_message`).
- `automation_run_record`: run_id, store_id, record_type, record_id, `role` ('subject' | 'changed'). It feeds "Automations on this record" for records a run changed but wasn't about (for example the product a run added to a collection). Index `(store_id, record_type, record_id)`.
- `automation_secret`: id, store_id, handle, value encrypted with the settings secret (same helper as phone crypto), created_by. It is used only by the HTTP action, and values are never returned to the client.
- `marketing_message` gains `automation_run_id` (nullable, FK to `automation_run`). `automation_id` keeps working because workflow ids reuse the old automation ids (9.4).

Retention: `automation_step_run` detail is kept **30 days** (Flow keeps 14). Runs (summary rows) are kept **13 months** for stats and record history, then pruned by a daily job like `{api}-activity-prune`. (My call.)

### 8.4 Registry of triggers and actions

One registry in `@commerce/core/automations/registry.ts` (server) plus a client-safe descriptor list (`@commerce/core/automations/catalog`) for the editor:

```ts
type TriggerDef = { id; label: {en; hi?}; subject: SubjectType; source: 'outbox' | 'sweep' | 'schedule' | 'manual' | 'plugin';
                    outboxTypes?: OutboxEventType[]; configFields: FieldSpec[]; fields: SubjectSchemaRef; pluginId?: string }
type ActionDef  = { id; label; subject?: SubjectType[]; configFields: FieldSpec[]; risk: 'safe' | 'customer' | 'sensitive';
                    permission: Permission; preview(ctx, input): Promise<Preview>; run(ctx, input): Promise<ActionResult>;
                    external: boolean; pluginId?: string }
```

- `FieldSpec` is a small serialisable form spec (text, number, money, select, tags, record picker, template text with merge tags, secret picker), in Activepieces' "props" style. The editor renders it, so plugins add config without React.
- `permission` is the permission a member needs to **publish** a workflow containing the action (8.7).
- `run` must be idempotent per `(run_id, node_id, iteration)`. Internal actions write their effect and their `automation_step_run` row in **one transaction** (exactly once). External ones (email, WhatsApp, HTTP, plugin) are at-least-once and get the step-run id as the idempotency key.

**Built-in triggers (v1)**: Order placed, paid, fulfilled, cancelled, delivered; Refund created; Return requested; Customer created; Customer tags changed*; Product created*, Product updated*; Stock low*, Stock out* (variant crosses the store's low-stock threshold or 0); Checkout abandoned and Cart abandoned (sweeps, today's logic); Customer subscribed; First order; Customer lapsed (sweep); COD order placed; Scheduled time; Run manually: order / customer / product. (* means new outbox event types. `catalog.products_changed` gets `product.created`/`product.updated` siblings written at the same call sites, and the stock event fires on a threshold crossing, not every change.)

**Built-in actions (v1)**: Add/remove order tags; Add/remove customer tags; Add/remove product tags; Add order note (timeline); Set metafield (order/customer/product); Add/remove product in a manual collection; Hold / release fulfilment (`fulfillment-orders.ts` `on_hold`); Fulfil order (no courier, marks fulfilled: `fulfilRemainingLines`); Cancel order (`cancelOrder`, `notifyCustomer` option); Alert staff by email; Alert staff on WhatsApp (to numbers typed in the action, sent through the store's own WhatsApp channel with a template the merchant picks in the same template picker the Growth WhatsApp step uses; the action is greyed out with "Connect WhatsApp and add a utility template" until one exists. There is no platform-wide staff template. Email is the default staff alert and works everywhere. Builder check, my call.); Send marketing email / Send marketing WhatsApp (Growth's steps, consent-gated); Send order update to customer (order email template or approved utility WhatsApp template, see Q4); Send HTTP request; Wait (a node kind, not an action).

Risk classes: `safe` = tags, notes, metafields, collections, staff alerts, hold/release; `customer` = anything that messages the shopper; `sensitive` = cancel order, fulfil order, HTTP request (data leaves the platform).

### 8.5 Execution

```
state change ──tx──▶ outbox_event ──relay──▶ {automations}-trigger job (jobId trg-<rowId>)
sweeps / schedules ──{automations}-tick (30 s)──▶ trigger sources
member "Run automation" ──API──▶ runs created directly
            │
            ▼  for each ON workflow with that trigger_type (one indexed query):
     insert automation_run … on conflict (workflow_id, trigger_key) do nothing
            │
            ▼  {automations}-step job (jobId run-<runId>-<cursor>), fairProcessor per store
     lock run (FOR UPDATE SKIP LOCKED) → walk nodes until wait / approval / end / error
```

- **Relay**: `dispatchRow` gets one more consumer. If any ON workflow in the store has a trigger that listens to the row's type (a cheap cached check, or always enqueue and let the job no-op), it enqueues `{automations}-trigger` with `jobId trg-<rowId>`. Re-dispatch is a no-op, as today.
- **Trigger job**: loads the subject, applies trigger-level filters (imported → never; test-mode orders → only with `includeTest`; `dedupeMinutes`; plan quota, 8.6), and creates runs idempotently. Conditions are **not** evaluated here. They run as nodes, so the run log shows why a run went one way.
- **Step job**: one run per job. It walks nodes in order. Conditions read **fresh** data at the moment they run (after a wait, the order may have changed), not the trigger snapshot. Each action runs in its own `withStore` transaction. On a wait it sets `status=waiting, next_at`. The tick picks waiting runs due (`(store_id, status, next_at)`), as `processDueRuns` does, and re-enqueues them. The **DB is the source of truth**: a Redis loss loses no waits, and the tick re-enqueues anything `queued`/`running` older than 5 minutes.
- **Retries**: internal action errors are transient (DB lock, deadlock) and get 3 quick retries; logic errors (order already cancelled) fail the step immediately. External actions: 429/5xx/timeout use exponential backoff up to **24 h** (HTTP default; Flow uses 24 h), other 4xx fail. HTTP per-action choice of Retry / Fail / Continue, as in Flow. A failed step fails the run unless `onError: 'continue'`. Members can **Retry from failed step** (same run, attempt+1) or **Cancel**. Turning a workflow Off cancels its waiting runs only after a confirm dialog ("12 runs are waiting. Cancel them, or let them finish?"). (My call: offer both. Flow cancels.)
- **Loop protection**:
  1. Actions run as an `automation` actor carrying `{runId, depth}`. `insertOutboxEvent` gets an optional `cause` that is stored in the payload (`payload.automation = {runId, depth}`), so an event caused by a run carries `depth + 1`. The trigger job **does not start runs at depth ≥ 3** and logs the run as `skipped` (reason "Started by another automation too many times").
  2. A workflow never starts a run from an event its own run caused on the same subject.
  3. Circuit breaker: more than **50 runs of one workflow for one subject in an hour**, or more than **1,000 failures in an hour** for one workflow, switches the workflow Off with `problem` set and alerts the owner by email.
  4. Actions that change nothing (tag already there) emit no outbox event.
- **Fairness and rate limits**: both queues use `fairProcessor` with per-store caps in `QUEUE_LIMITS` (proposed `{automations}-step` concurrency 20 / perStore 4). HTTP calls: per store at most 10 requests/s and 5 concurrent, 30 s timeout, response capped at 1 MB and stored truncated. Private and loopback IPs are blocked (SSRF guard, same rules as any outbound fetch we do). Customer messages use the existing marketing send rate limits.
- **Per-plan limits** (one table in `billing/plans.ts` → `automations: { activeWorkflows, runsPerMonth, http: boolean }`; numbers pending Q1). Metered per calendar month in India, like `ai_usage`. At the limit, new runs are `skipped` with reason "Monthly run limit reached", runs already started finish, and the owner is emailed at 80% and 100%. **Growth-origin workflows are not metered and never skipped** (they have no cap today, and the migration must not stop a store's abandoned-checkout recovery). Their runs are counted for display only. (Builder check, my call.)
- **Scheduled trigger**: hourly, daily at HH:MM, or weekly on day+time (IST). The minimum is hourly (Flow allows 10 minutes; my call, to keep tick load sane). `next_fire_at` lives on the workflow, and the run's trigger key is `schedule:<fireAt>`. v1 schedules run with subject `none` (alert staff, HTTP). "Find records + For each" comes in Phase 5.

### 8.6 Run log and record history

- **Runs page** (app) and the **workflow's Runs tab**: status chips (In progress, Waiting, Needs approval, Completed, Failed, Cancelled, Skipped), filters (workflow, status, date, record), search by order number / customer email / product. 30 days of detail, 13 months of summary rows.
- **Run detail**: the workflow diagram with the path taken highlighted (green = ran, grey = not reached, red = failed, amber = waiting or needs approval). Each step expands to its input, output and error, with timestamps and attempts. Actions: Retry from failed step, Cancel, Open record.
- **Automations on this record**: a card on order, customer and product detail pages listing runs where the record is the subject or was changed (`automation_run_record`), with status and a link to the run. Every internal action also writes a **timeline entry** on the record ("Tag VIP added by automation *High-value orders*"), using the existing order notes/timeline for orders and the equivalent activity for customers and products, so the merchant sees it where they already look.

### 8.7 Safety and permissions

- **New permission resource** in `statement.ts`: `automations: ['read', 'write', 'publish']`.
  - `automations.read`: see workflows and runs. Run inputs and outputs show customer data only to members who also hold `customers.read`.
  - `automations.write`: edit drafts and run dry tests.
  - `automations.publish`: turn workflows on, publish versions, retry or cancel runs.
  - **Run automation** on a record: `automations.read` plus the permission the workflow's actions need (8.4 `permission`), checked when the member clicks.
  - **Growth workflows keep today's permissions**: `marketing.read` to see them, `marketing.write` to edit, `marketing.send` to switch them on. The Growth router keeps its guards. Growth workflows are also visible in the Automations app to `automations.read` holders, but editing them there needs `marketing.write` as well.
  - **Role seeding migration**: Owner gets everything (as now). Existing roles get `automations.read` if they hold any `orders`/`customers`/`products` read, and nothing more. Write/publish are granted by hand in the role editor. So no custom role loses access on cut-over day, and none gains publish rights silently. (Builder check, my call.)
- **Publishing checks**: publishing a version needs `automations.publish` **and** every action's own permission (`orders.cancel` for Cancel, `orders.fulfil` for Fulfil, `marketing.send` for marketing messages, `customers.write` for customer tags…). So a member can't automate something they couldn't do by hand. Runs then execute as the system actor "Automations", attributed in the timeline and audit to the workflow and its publisher. If the publisher later loses a permission or leaves, the workflow keeps running (as in Flow) but shows a warning to owners. (My call.)
- **Sensitive actions** (cancel, fulfil, HTTP): the publish dialog lists them and asks for a typed confirmation of the workflow name. **Cancel order defaults to "Ask before running"** (Q2): the step goes to `awaiting_approval`, and the approval state lives on the step run itself (`automation_step_run.status`, plus `approved_by` and `decided_at` columns, with the preview in `output`). It is **not** routed through `ai_action`. That table's approver model is "only the member who asked" and it lives under Settings → AI, which doesn't fit a standing workflow. (Builder check, my call.) Pending approvals show in the app's **Needs approval** tab (with a count badge on the app's sidebar entry), as a banner on the order page, and in the owner's daily summary email (`member-daily-summary`). Any member with `orders.cancel` can approve. The store-wide MCP "Changes need approval" switch does not apply to automations; only the per-action setting does. Approve → the step runs. Decline or expiry (72 h, my call) → the step is `cancelled` and the run follows `onError`. Fulfil and HTTP default to running without asking, with a per-action "Ask before running" switch.
- **Customer messages** keep every rule in `marketing/send.ts`: consent per channel, recipient must be the consenting customer, unsubscribe stops the run, and the COD confirmation transactional exception (8.8). The editor badges these steps "Messages customers".
- **Dry run / Test with a record**: in the editor, "Test" picks a real record of the trigger's subject (recent order, customer, product; a cart for abandoned triggers) or one of today's made-up shoppers. It walks the **draft** definition with a dry-run context: conditions evaluate on real data, actions call `preview()` (e.g. "Would add tags VIP, High value. Already has VIP.", "Would cancel order #1042 and email the shopper", "Would POST to https://… with body …"), and waits are shown and skipped. A dry run writes nothing: no run row, no change, no message. The result renders in the same run-detail view, labelled "Test, nothing changed". The publish button suggests a test when none was run on the current draft.
- **MCP / AI**: workflow CRUD is reachable through the MCP action catalogue like any procedure. `automations.publish`, `setStatus` and approving an automation step are classed **sensitive** (always wait for approval). A workflow is a standing order to change the store, so an AI client must not switch one on unseen. Reads are reads.

### 8.8 Templates

Templates are definitions shipped in `@commerce/core/automations/templates.ts`, with `{id, name, description, category ('orders' | 'customers' | 'inventory' | 'marketing' | 'operations'), definition, requires?: pluginId[]}`. Plugins can add templates (8.9). The gallery is filterable by category, and installing creates an Off workflow with a draft.

Starter set: the 6 Growth templates (marketing), Tag high-value orders (total > ₹N → tag + alert staff), Hold risky COD orders (COD and total > ₹N or pincode in list → hold + note + alert), Tag repeat customers (order count ≥ 3 → customer tag), Low-stock alert to staff, Add new products to "New arrivals" (product created → add to collection; a scheduled removal later), Alert on return requested, Notify packer on WhatsApp when an order is paid, Cancel unconfirmed COD after N hours (sensitive, approval on).

### 8.9 Plugin connectors

Manifest gains an optional `automations` block (types in `packages/plugins/src/types.ts`, serialisable like `orderActions`):

```ts
automations?: {
  triggers?: { id: string /* <pluginId>/<name> */; label; subject: SubjectType | 'none'; fields: FieldDescriptor[] }[]
  actions?: { id; label; configFields: FieldSpec[]; risk: 'safe' | 'customer' | 'sensitive'; permission?: string;
              run: AppAutomationAction /* (ctx: AppHookContext, input: { stepRunId, subject, config }) => Promise<{ output?: unknown }> */;
              preview?: … }[]
  templates?: TemplateDef[]
}
```

- **Firing a plugin trigger**: `AppHookContext` gains `triggerAutomation(triggerId, { subjectType, subjectId?, data, key })`. It writes an outbox row (new type `automation.app_trigger` with `{triggerId, key, data}`) in the plugin's transaction. The rest is the normal path, and the trigger key `app:<pluginId>:<key>` keeps it idempotent. So the Meta/Google/Shopify integrations' webhooks (lead received, catalogue sync failed, Shopify order imported…) become triggers by calling this from their webhook handler.
- **Plugin actions** run as an app job (`enqueueAppJob`) with the step-run id as the idempotency key, the same retry rules as 8.5, and the result written back to the step run. Throwing with a `{retryable: boolean, message}` error decides retry vs fail (the Flow 4xx/5xx contract, in-process).
- Triggers and actions show only while their app is installed. Uninstalling an app switches Off the workflows that use its pieces, with `problem` = "App X was removed". The manifest's `access.resources` must cover what the actions touch. The catalogue generator picks up "Works with Automations" for the listing badge.
- The `app-catalogue` sweep and a new sweep check that ids are namespaced and that FieldSpecs serialise.

**Coordination**: the platform-apps agent should know about `triggerAutomation` and the `automations` manifest block before finalising their webhook handlers. They need no engine code yet, only a call site to add later.

## 9. Admin UX

### 9.1 App placement
`automations` plugin manifest: `kind: 'builtin'`, category `operations` (new; Shopify lists Flow under store management), `admin.pages`: Workflows (root), Templates, Runs, Settings (secrets, approval defaults, plan usage meter). It is listed on the App Store website through the generated catalogue, and shows in Installed apps with "Last activity" ("Ran 214 times today"). Copy goes in `data/automations.ts` + `data/hi/automations.ts`.

### 9.2 Editor (Flow-like)
- Vertical canvas: the trigger card at the top, then nodes. A condition splits into **Then** / **Otherwise** columns. A "+" on every edge opens a picker (Conditions / Actions / Wait, searchable, grouped by resource, plugin items under their app icon). It extends Growth's `automation-flow*` components (node, joint, sortable stack) into a branching tree, not a free-form canvas (no React Flow dependency; my call).
- Right panel: the selected node's config, rendered from `FieldSpec`. The condition builder has a field picker (tree of the subject schema), an operator and a typed value input (money in ₹, state dropdown with Indian states, tag chips), AND/OR groups and an any/all quantifier for line items.
- Header: name, On/Off, **Test**, **Publish**, version menu (history, restore a version as draft, diff summary "3 steps changed"). Unpublished changes show a banner, and the live version keeps running.
- Validation before publish: every branch ends, required config is set, merge tags are known, plan limits are respected, permissions are held, and sensitive actions are confirmed.
- Mobile: read-only diagram plus On/Off and runs. Editing is desktop (Flow does the same).

### 9.3 Records
- **More actions → Run automation…** on the order, customer and product detail pages. The dialog lists ON workflows with the matching manual trigger, shows a dry-run preview for that record ("This will: add tag…, cancel order (asks for approval)") and asks to confirm. **More actions → Automation runs** opens the runs page filtered to the record.
- **Bulk bar → Run automation** on the Orders, Customers and Products lists: up to **250 selected records** per click (my call). It creates runs with key `manual:<requestId>:<recordId>` and shows a toast with a link to the filtered runs.
- **Automations card** on detail pages (8.6). Orders use the existing `orderActions` plumbing for the menu items. Customers and products need the same generic `recordActions` slot (a small extension of `AppAdmin` with `customerActions`/`productActions`, sharing the `OrderAction` shape).

### 9.4 Growth → Automations (backed by the engine)
- It stays in Growth with today's list, stats (runs, sent, opened, clicked, orders, revenue) and its linear editor with the email designer and WhatsApp template picker. It now reads and writes `automation_workflow` rows with `origin='growth'`, and the linear step list is shown as a straight-line tree (condition = "continue only if", Otherwise = stop with reason `condition`).
- Growth works **whether or not the Automations app is installed**. The engine is core; the app unlocks the general builder, record actions and non-marketing triggers/actions (Q3). With the app installed, a Growth automation shows "Open in Automations" for branching and the extra actions. It keeps `origin='growth'`, so it stays in Growth's list and stats. Once its tree has a branch or a non-marketing action, Growth's linear editor opens it **read-only** (the diagram, stats and On/Off still work) with "Edit in Automations". It is never flattened. Phase 1 builds the read-only mode. (Builder check, my call.)
- The Automations app's Workflows list shows Growth workflows too (filter chip "Marketing").

## 10. Migration of the 6 marketing automations

Expand → migrate per store → contract:

1. **Expand** (Phase 0/1 migration): create the engine tables, add `marketing_message.automation_run_id`, and add a per-store flag `store.preferences.automationsEngine = 'legacy' | 'engine'` (default legacy).
2. **Map definitions** (pure function, unit-tested per template and per hand-edited shape). **The workflow id = the old `marketing_automation.id`**, so `/growth/automations/[id]` URLs and `marketing_message.automation_id` still resolve.

| Old trigger | Engine trigger | Notes |
|---|---|---|
| checkout_abandoned | `checkout.abandoned` (sweep, config `afterMinutes`) | `exitOnOrder: true`; 7-day lookback and `recoverySentAt` rules move into the sweep |
| cart_abandoned | `cart.abandoned` (sweep, `afterMinutes`) | `exitOnOrder: true` |
| customer_subscribed | `customer.subscribed` (from `enrolSubscriber`, now an outbox event `customer.subscribed`) | `exitOnOrder: true` |
| first_order | `customer.first_order` (fired from the order.placed trigger job when non-imported order count = 1) | |
| customer_lapsed | `customer.lapsed` (sweep, `lapsedDays`) | `exitOnOrder: true` |
| cod_order_placed | `order.cod_placed` (order.placed where payment method = COD) | First WhatsApp step keeps the transactional exception |

Steps map 1:1 in order: `wait` → wait node; `email` → `marketing.send_email` action (subject, previewText, blocks unchanged); `whatsapp` → `marketing.send_whatsapp`; `condition` → condition node (field mapping `cart_value`→`subject.total`, `order_count`, `has_ordered`, `accepts_marketing`) with Otherwise → end with `stop_reason='condition'`. Node ids = old step ids. `isTransactionalStep` becomes a check in `marketing.send_whatsapp`: transactional only if the trigger is `order.cod_placed` and the node is the first node with no wait before it. That is the same rule, now evaluated on the tree.
3. **Map runs**: every `marketing_automation_run` row (all statuses, for stats) is copied to `automation_run` with the **same id**, the same `trigger_key`, `cursor` = the node id at `step_index` (or null if finished), the same `next_at`, status mapped (`active` → `waiting`/`queued`, the rest kept), and the marketing columns copied. `marketing_message.automation_run_id` is set from the same id.
4. **Cut over per store, in one transaction**: lock the store's old runs (`FOR UPDATE`), copy, set the flag to `engine`. The old marketing tick skips stores flagged `engine` (it checks the flag inside its own store transaction, so it can't interleave). The engine tick only touches `engine` stores. No store is ever run by both. If anything fails, the transaction rolls back and the store stays legacy.
5. **Verify**: a script compares per store the count of active runs, the next due times and the stats from `automationStats` old vs new. Roll out to the test server (vioratech.in, `dev`), then a few real stores, then all.
6. **Contract** (after every store has been on `engine` for 14 days): delete the old runner (`processDueRuns`, `enrolDue`, `onOrderPlaced` enrolment), keep `marketing_automation`/`marketing_automation_run` read-only 30 more days, then drop them in a migration.

Parity tests: port `automations.test.ts` cases (conversion, unsubscribe stop, recipient mismatch, COD transactional, imported exclusion, lookback, idempotent enrolment) to run against the engine path, all passing before any store flips.

## 11. Phased build plan

Sizes: S ≈ 1–2 days, M ≈ 3–5, L ≈ 1–2 weeks, XL ≈ 2–3 weeks, for one agent with review.

| Phase | Scope | Size | Ships to merchants? |
|---|---|---|---|
| **0. Engine core** | Tables + RLS migration; definition zod schema; registry; interpreter (condition/action/wait); trigger job from outbox; step job + tick; idempotency; retries; loop guard (`cause` on `insertOutboxEvent`); run log API (`automations.*` router); permissions resource; unit + integration tests | L | No (behind flag) |
| **1. Growth on the engine** | `marketing.send_email/whatsapp` actions; sweep triggers (abandoned/lapsed); `customer.subscribed`, first order, COD triggers; definition + run migration; cut-over flag and verify script; Growth UI rewired (same look); parity tests; staged rollout | L | Yes, invisibly |
| **2. Automations app v1** | Manifest + catalogue listing + docs; new outbox events (product created/updated, customer tags changed); fields schema + condition builder; safe actions (tags, notes, metafields, collections, hold/release, staff alerts); branching editor; templates gallery; runs page + run detail; Test with a record (`preview`); per-plan limits and usage meter | XL | Yes |
| **3. Records** | Manual triggers; Run automation in More actions (order, customer, product) and bulk bars; `customerActions`/`productActions` slots; Automations card; timeline entries | M | Yes |
| **4. Sensitive and outbound** | Cancel and Fulfil actions; step-run approvals + Needs approval tab + order banner; customer order-update message; HTTP request + secrets + SSRF guard; MCP classification | M | Yes |
| **5. Schedules and stock** | Scheduled trigger; Stock low/out events; Find records + For each (≤ 100 items, Flow's limit); circuit-breaker emails; retention pruning | M | Yes |
| **6. Connectors** | Manifest `automations` block; `triggerAutomation`; plugin action jobs; developer docs page; first connector from the platform-apps work (e.g. Meta lead received → tag + alert); contract (drop old tables) | M | Yes |

Phases 0 → 1 → 2 are strictly in order. 3 and 4 can run in parallel after 2. 5 and 6 can run in parallel after 2. Total ≈ 10–13 weeks single-threaded, about 7 with two agents after Phase 2.

## 12. Left to the builder

- Table and column names beyond those fixed above, index tuning, exact zod shapes of `FieldSpec` and the subject schemas.
- Whether the relay always enqueues the trigger job or first checks a cached "store has workflows for this type" set.
- Editor component structure (within `docs/conventions.md`), icons, empty states, the exact copy (in `data/`), and the Hindi overlay.
- The exact backoff curve, queue concurrency numbers, run-detail truncation sizes.
- How the timeline entry is written for customers and products if no shared activity table exists (reuse what is there, or add a minimal one).
- Test layout; which `automations.test.ts` cases need fixtures vs pure tests.
- Splitting phases into PRs (each PR records its handoff change file).

## 13. Calls I made (owner can overturn)

- Build, not adopt (section 7); credit Activepieces if any code is adapted.
- Tree-shaped workflows (no merging branches), at most 50 nodes, condition nesting depth 2.
- Run detail kept 30 days, summary 13 months.
- Runs pinned to the version they started on.
- Loop guard depth 3; circuit breaker 50 runs/subject/hour.
- Schedules no more often than hourly.
- Bulk Run automation capped at 250 records per click.
- Approvals live on the step run, with a Needs approval tab in the app, an order-page banner and a line in the daily summary email; `ai_action` isn't reused; expiry 72 h; the MCP approval switch doesn't apply.
- Publisher must hold every action's permission; workflows keep running if the publisher leaves.
- Turning a workflow Off asks whether to cancel or finish waiting runs.
- Growth workflows are never metered or skipped by plan run limits.
- Growth workflows keep the marketing.* permissions; roles are seeded with `automations.read` only.
- Staff WhatsApp alerts use the store's own channel and a merchant-picked template; email is the default.
- A branched Growth workflow is read-only in Growth's editor.
- No Shopify Flow workflow import.
- Branching editor extends Growth's components, no React Flow dependency.
- New permission resource `automations: read/write/publish`; publishing via MCP is sensitive.

## 14. Questions only the owner can answer

Open until the owner answers. Each has a recommendation, and the doc assumes the recommendation where it needs one.

1. **Price and plan limits.** Recommended: the app is free on every plan (Shopify Flow is free), with limits in `PLANS`: Starter 5 active workflows / 2,000 runs a month; Growth 25 / 20,000; Pro unlimited / 200,000. HTTP request and plugin-connector actions from Growth up. → 8.5 per-plan limits, `billing/plans.ts`.
2. **Sensitive actions.** Recommended: Cancel order always asks for approval by default; only the Owner can switch "Ask before running" off per workflow. Fulfil and HTTP run without asking but need a typed confirm at publish. Refund stays out of v1. → 8.7.
3. **Growth without the app.** Recommended: Growth's marketing automations keep working with no install (the engine is core). Installing Automations unlocks the general builder, record actions and non-marketing triggers/actions. → 9.4, gating in Phase 2.
4. **"Send customer a message" from general workflows.** Recommended: two actions. *Send marketing message* is consent-gated (today's rules). *Send order update* only allows the store's existing order email templates and WhatsApp templates the merchant marks as utility/transactional, and needs no consent but only fires on order triggers to the order's own contact. → 8.4, Phase 4.
