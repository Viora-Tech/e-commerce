# Xpressbees, Ekart and Shadowfax courier apps (2026-10-20)

Three more Indian last-mile couriers, one package each so a merchant installs only the ones
they use: `packages/shipping-xpressbees`, `packages/shipping-ekart`,
`packages/shipping-shadowfax`. Same shape as `shipping-rapidshyp`: manifest (`plugin.ts`),
browser-safe capabilities (`client.ts`), delivery checker block, adapter, and every wire
shape plus status mapping in one `mapping.ts`. Branch `feat/courier-xpressbees-ekart-shadowfax`.

## What each one does

| | Xpressbees | Ekart | Shadowfax |
| --- | --- | --- | --- |
| Auth | email + password -> bearer token (`/users/login`) | client id + username + password -> token, `expires_in` ~24h | static `Authorization: Token <key>` |
| Serviceability | rate call, prepaid + COD | `/api/v2/serviceability/{pin}` (COD flag) + v3 route TAT | `/v1/clients/serviceability` (listed = serviceable) |
| Rates | every service (`quoteOptions`, bookable by `courier_id`), freight + COD itemised | `quoteRate` only (cheapest courier group estimate + TAT; booking can't pick a group) | none (no API) |
| Book | `/shipments2`, prepaid + COD, `request_auto_pickup: yes`, label URL back | `PUT /api/v1/package/create`, Prepaid/COD | `/v3/clients/orders/` marketplace model, label via `/client/generate_label/` |
| Label | URL from booking | not wired: Ekart returns PDF bytes (`downloadLabel` ready for a proxy route) | URL (until pickup) |
| Manifest | `generateManifest(awbs)` (no contract slot yet) | `generateManifest(ids)` | auto |
| Tracking | poll `/shipments2/track/{awb}` + webhook | poll open `/api/v1/track/{id}` + `track_updated` webhook | poll forward/reverse v4 + push callback |
| Webhook auth | HMAC-SHA256 base64 `x-hmac-sha256` (or shared-secret header) | HMAC-SHA256 hex/base64 | Authorization header = key |
| Cancel | `/shipments2/cancel` | `DELETE /api/v1/package/cancel` | forward cancel (304 = queued), reverse `mark_cancel` |
| NDR | re-attempt, change address, change phone (RTO refused: dashboard only) | Re-Attempt (+phone/address), RTO | `order_update` reopen_ndr / rto |
| Return pickup | no | yes (`payment_mode: Pickup`) | yes (`/v3/clients/requests`) |

NDR: the queue opens from the latest scan's wording, so each adapter prefixes "Undelivered: "
when the courier's code marks a failed attempt (`scanDescription`). All three fail closed on
webhooks without a configured secret.

## Shared pieces

- `@commerce/shipping`: `LoginTokenCache` (login once, refresh before expiry, one retry after
  a 401) and `hmacSha256Matches` / `firstHeader` in `webhook-auth.ts`. Tests in
  `packages/shipping/test/webhook-auth.test.ts`.
- `packages/api/src/routers/store.ts`: the per-courier "Test connection" procedures are now
  one `courierConnectionTest(providerId)` builder; added `testXpressbeesConnection`,
  `testEkartConnection`, `testShadowfaxConnection` (skipped in `cross-store-leak.test.ts`).
- Admin: `components/apps/{xpressbees,ekart,shadowfax}/{connect,overview}-page.tsx`, a shared
  `components/apps/shared/courier-advanced-fields.tsx` (base URL + webhook secret + webhook
  URL). Copy in `data/{xpressbees,ekart,shadowfax}.ts` with Hindi overlays in `data/hi/`; these
  pages read copy through `useCopy` (the older courier pages still import it directly).
  Connect-aside cards, Recommended reasons, settings search and `apps-recommended` list them.
- Wiring: `commerce.config.ts`, root `package.json`, `turbo.json`, sweeps (`walk.ts`,
  `secret-fields.test.ts`), public App Store (`apps/www/src/data/apps.ts`).
- Docs: merchant guide Couriers (three new tabs), App Store table, Shipments; developer docs
  Plugins (shared helpers, NDR wording rule).

## Sources

- Ekart: Ekart's own OpenAPI "Ekart API Docs" v3.8.9 for the Elite platform
  (`app.elite.ekartlogistics.in/api/docs`; Ekart is retiring the old `api.ekartlogistics.com`).
- Shadowfax: its Apiary docs (Unified API for Forward Integrations; Reverse Pickup API).
- Xpressbees: no public docs page; the PDF the account team hands out, as reproduced by
  several independent integrations that agree. Nothing was copied; no SDK adopted (the only
  candidates were an unofficial Go client for Ekart and app code with no licence).

## VERIFY WITH A LIVE ACCOUNT

Marked "VERIFY" in each `mapping.ts`:

1. Xpressbees: webhook signature header and encoding (`x-hmac-sha256`, base64); NDR
   `change_address` keys (`address_1`/`address_2`); token lifetime (cached 6h, re-login on 401);
   whether `courier_id` from serviceability is accepted by `/shipments2`.
2. Ekart: webhook signature header name (we accept `x-ekart-signature`,
   `x-ekart-webhook-signature`, `x-hmac-sha256`, `x-signature`); pickup autofill when
   `pickup_location` is omitted (one registered address); cancel response shape.
3. Shadowfax: forward create body field names (`/v3/clients/orders/`), forward tracking shape
   (`/v4/clients/orders/{awb}/track/`), `order_update` NDR body, label link for forward AWBs,
   COD availability (assumed on for every serviceable PIN), dashboard URL in the guide.

## Not done / follow-ups

- Real logos: the three apps use the fallback tile (no files added to `public/app-logos`).
- Ekart label printing needs a label proxy route (stream `downloadLabel`).
- Manifest download has adapter methods but no contract slot or button.
- No live tests: mocked fetch only (`bun run test` in each package).
