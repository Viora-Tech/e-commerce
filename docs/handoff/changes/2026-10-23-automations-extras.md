# Automations: trigger emitters, owner alerts, retention prune, uninstall pause

- **Emitters** (all inside the change's own transaction):
  - `product.created` / `product.updated`: `createProduct` / `updateProduct`, the quick edit and
    variant price/SKU edit, bulk status/tag actions, bulk edit, AI field fills
    (`noteProductEvent`, `catalog/changes.ts`). **Imports (CSV, Shopify) write none**: like
    imported orders, imported products never start automations, so a big import adds no
    automation work (`{ imported: true }`).
  - `customer.tags_changed` with the diff: staff edit, bulk tag, account page, newsletter tag
    (`noteCustomerTagsChanged`, `customers/changes.ts`; automations write their own with a cause).
  - `customer.subscribed`: every fresh email or WhatsApp opt in through `setMarketingConsent`
    (not SMS, not `import`); the engine keys the welcome run per customer, so repeats are no-ops.
  - `inventory.low` / `inventory.out`: `watchStockCrossings` (`inventory/stock-events.ts`) around
    `adjustStock` (edits, imports, receiving), order reservation (`routeAndReserve`) and the quick
    stock edit. Available = on hand − reserved at selling locations; one row per product per
    crossing (falling to ≤ the store's low-stock threshold, or to 0).
- **Owner alerts** (`engine/owner-alerts.ts`): 80% and 100% of the month's runs (claimed once
  via `automation_usage.warned_at_*`) and circuit-breaker switch-offs write an
  `automation.owner_alert` outbox row; the relay queues it on the trigger queue and the worker
  emails the store's owners (else its contact address) through the store's email channel,
  logged in `notification` as `automation_owner_alert`.
- **Prune** (`engine/maintenance.ts`, worker `automations-prune`, daily): step detail after 90
  days, finished runs (and their record links) after 13 months; open runs and
  `automation_usage` are kept. Lists stores via `stores_with_old_automation_runs` (SQL function
  requested in auto-core's 0154 migration).
- **Uninstall**: `uninstallStoreApp` calls `pauseWorkflowsForRemovedApp`: workflows whose live
  version or draft uses the app's trigger or actions are switched off with a note.
