# Automations: action executors, conditions, real fulfilment holds

- **Executors** `packages/core/src/automations/actions/` (registered in `actions/index.ts`,
  `registerBuiltinActions(host?)`; the worker passes its settings secret and storefront URL):
  `tags.ts` (order/customer/product tags; customer tags lower-case; `customer.tags_changed` and
  `product.updated` events carry the run cause), `order.ts` (note, hold, release, fulfil, cancel),
  `records.ts` (metafields via `setMetafields`, manual collections), `messages.ts` (staff email /
  WhatsApp), `marketing.ts` (Growth parity: run contact + `recipient_mismatch` skip, COD
  confirmation transactional, cart block, `discount_code`, `recovery_sent_at`,
  `automation-<template>` UTM), `order-update.ts` (order email templates or approved UTILITY
  WhatsApp templates, no consent), `http.ts` (HTTPS only, `safeFetch` SSRF guard, `{{secrets.x}}`
  from `automation_secret`, `X-Webhook-Signature: sha256=HMAC(key, "<ts>.<body>")` with the
  store's `signing_key` secret or `httpSigningKey(storeId, SETTINGS_SECRET)`, `Idempotency-Key` =
  step key, 10 req/s and 5 concurrent per store). Messages dedupe on `marketing_message
  (automation_run_id, automation_node_id)`; events written by core services in the step are
  stamped with the run cause (`stampCause`).
- **Conditions** `conditions/`: `evaluate.ts` (operators per field type, any/all/none over line
  items and tags, calendar dates in the store's zone via `@commerce/dates`), `loaders.ts`
  (order, customer, product, cart data at the `condition-fields.ts` paths, plus `store`).
- **Fulfilment hold** (migration `0154_fulfillment_hold`: `fulfillment_order.held_at`,
  `hold_reason`): `order/fulfillment-hold.ts`. `createShipmentForOrder` refuses a held parcel
  (`FulfillmentOnHold`), Create shipment marks the order `blocked: 'on_hold'`, Ready to ship
  leaves it out; release lifts it. Pre-order `status = on_hold` is unchanged.
- **Fulfil without notice**: `fulfilRemainingLines(..., { notifyCustomer: false })` →
  `order.fulfilled` payload `notifyCustomer: false` → the relay queues no shopper message.
- **Cancel without restock**: `cancelOrder(..., { restock: false })` writes the unpacked units
  off (`writeOffCommittedStock`), so available stock stays as it was.
