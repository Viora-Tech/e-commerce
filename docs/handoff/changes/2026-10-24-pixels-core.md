# Pixels app, PR 2 of 5: core rules, hashing and the Meta client

Pure engine pieces for the Pixels app, in `packages/core/src/pixels/`. Stacked on PR 1 (data).
Design: `docs/superpowers/specs/2026-10-24-pixels-design.md`.

- `client.ts` (`@commerce/core/pixels`, browser-safe): event names and triggers, event ids
  (`ord_<orderId>`, `ic_<cartId>`, `atc_<lineId>_<n>`, UUID otherwise) plus `isValidEventId` for the
  collector, `purchaseTriggerMatches` (incl. `paid_or_delivered`: prepaid when paid, COD when
  delivered), `browserSendsPurchase` (only "placed"), the consent gate, `purchaseSkipReason`
  (test → imported → no tracking → no consent → older than 7 days), and the `_fbp`/`_fbc` formats.
- `hash.ts` (server): Meta normalisation and SHA-256. Phone uses `normalisePhone` (Indian rules), names
  keep any script, state is the two-letter code via `stateCode`, PIN is six digits, country `in`.
- `meta.ts` (server): `buildMetaEvent` (rupees, contents, `order_id` = order number), `matchedOf`
  (booleans), `classifyMetaError` (190/102/401 → auth; 1/2/4/17/32/341/613, 429, 5xx, network → retry;
  else fail), `sendMetaEvents` (token in the body, never the URL; scrubbed from messages) and
  `verifyMetaToken` (`GET /<pixel>?fields=id,name`, bearer header).
- `@commerce/core/pixels/server` re-exports all three.
- Unit tests: `client.test.ts`, `hash.test.ts`, `meta.test.ts` (fake fetch only; no real Graph calls).
- No-orphans allow-list entries for `hash.ts`/`meta.ts` (and PR 1's tables) are removed in PR 3.
