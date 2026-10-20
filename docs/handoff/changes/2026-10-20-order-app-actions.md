# Orders: app actions in More actions, the row menu and the bulk bar (Shopify style)

Branch `feat/order-app-actions`. No migration.

- **Extension point** (`packages/plugins`): `admin.orderActions` on a manifest, typed
  `OrderAction` (`id`, `label: { en, hi? }`, `targets: detail | row | bulk`, `handler`,
  `permission?` default `orders.write`, `requires?: open | unfulfilled | paid-or-cod | not-test`).
  Handlers are data: `link` (admin path with `{orderId}` / `{orderIds}`), `procedure` (a key
  `<pluginId>/<name>` the admin maps to an API call), `shipment` (`providerId`).
  `definePlugin` validates them (`validateOrderActions`); `summaries()` carries
  `admin.orderActions`, which `orderActionsOf` fills with the declared ones plus a "Create
  shipment" (`ship-<providerId>`, `orders.fulfil`) for every courier a non-core plugin provides.
  Tests: `packages/plugins/test/order-actions.test.ts`.
- **API**: `apps.orderActions` (`orders.read`) returns groups `{ appId, appName, icon, actions }`
  for installed + set-up apps, actions the member's permissions cover, and couriers that are
  switched on (pure `orderActionGroups` in `services/order-actions.service.ts`).
  `gstInvoices.generate({ orderId })` queues and issues the order's tax invoice(s) at once
  (dated when dispatched, else today; returns `issued` / `alreadyIssued`; test orders refused).
  `gstInvoices.queue.add` takes `skipIneligible` (skips test and gift-card-only orders, returns
  `skipped`). Both live in `routers/gst-invoices-order-actions.ts` (keeps the router under the
  500-line sweep). Tests: `packages/api/test/order-actions.test.ts` (needs Postgres).
- Sweeps: `orderActionGroups` allow-listed in no-orphans (exported for its test);
  `soldOnlyGiftCards` dropped from it (now imported); router-magic-limits entry moved to the new
  file. `no-orphans` still flags `shopPolicies` (`packages/core/src/theme-import/page-context.ts`),
  already on `dev`, not from this PR.
- **GST invoices manifest**: "Generate GST invoice" (detail, row) and "Add to invoice queue"
  (detail, row, bulk), both `not-test`.
- **Admin**: `apps/admin/src/apps/order-actions.ts` (pure: conditions, `actionsFor`, labels,
  links; tests beside it), `order-action-procedures.ts` (the `procedure` registry),
  `components/orders/use-order-app-actions.ts` (menu items with the app's name as a heading and
  its icon, runs them). `ActionMenu` items gained `heading` and `id`. Wired into the order page's
  More actions (plus a first-class **Create shipment** for open, to-pack, paid-or-COD orders when
  the member has `orders.fulfil`), the Orders list row menu, and the bulk bar (new More actions
  menu; a courier's Create shipment opens `CreateShipmentDialog` with that courier).
- **Create shipment preselect**: `/orders/<id>/ship?courier=<providerId>` starts the page on that
  courier (`startingPick(options, preferred)`); the bulk dialog's `courier` prop starts on "one
  courier for all" with it (`startingBulkPick`). Tests in `flow-state.test.ts`.
- Docs: developer docs → Plugins → "Order actions".
- Not done: the Shipments page's order view (`/orders/shipments/<id>`) does not pass app actions.
