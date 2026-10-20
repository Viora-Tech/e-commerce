# Integration: app + courier PRs

Branch `integrate/apps-couriers`: `dev` plus six feature branches merged in one go, conflicts
resolved once, into one PR. Supersedes #615 #616 #617 #618 #637 #640.

## Merged, in order

1. `feat/app-chatwoot` (live chat, customer sync, Conversations card)
2. `feat/courier-bluedart-dtdc` (Blue Dart, DTDC; label PDFs in private storage)
3. `feat/courier-india-post` (counter-booked courier, manual tracking)
4. `feat/courier-xpressbees-ekart-shadowfax`
5. `feat/courier-dhl-fedex` (export-only couriers, customs fields, PDF documents)
6. `feat/app-growthbook` (A/B tests for sections and Liquid themes)

Almost every conflict was additive (registries, plugin lists, sweeps allow-lists, turbo deps,
copy, docs) and keeps both sides. The non-trivial ones:

- **Label PDFs, one mechanism.** Blue Dart / DTDC return `labelDocument` (one PDF, kept in the
  store's private storage, served by `/api/shipments/<id>/label`). DHL Express / FedEx return
  `documents` (label + commercial invoice, base64), which their branch joined and saved at a
  public, random URL. Now `label-documents.ts` only joins (`shipmentDocumentsAsLabel` →
  `ShippingLabelDocument`) and `createShipmentForOrder` sends either result through
  `storeShippingLabel`. Both result fields stay in the contract; `labelUrl` > `labelDocument` >
  `documents`.
- **Courier rates.** The coverage check (DHL/FedEx) runs first; India Post's
  `needsTrackingNumber` flag is applied to whatever rows come back.
- **`CreateShipmentInput`** keeps `trackingNumber` (India Post) and `dimensionsCm` /
  `exporterGstin` (exports); `CreateShipmentResult` keeps `trackingUrl`, `labelDocument`,
  `documents`.
- **Test connection procedures**: the one `courierConnectionTest` builder, with Xpressbees,
  Ekart, Shadowfax, DHL Express and FedEx entries.
- **Docs**: courier tabs and the App store table list every courier (Delhivery, Shiprocket,
  RapidShyp, Blue Dart, DTDC, Xpressbees, Ekart, Shadowfax; India Post and the export couriers
  have their own pages).

## Migration renumber

`feat/app-growthbook` had `0140_app_growthbook` (journal idx 130), which clashed with dev's
`0141_store_money_format` / `0142_email_design`. Renamed to **`0143_app_growthbook`**: journal
idx 132, `when` after 0142, snapshot `prevId` = 0142's id, content = 0142 + `experiment_event`.
The SQL is unchanged (still ends with `SELECT apply_store_rls();`). `drizzle-kit generate` says
"No schema changes". Doc references updated.

## Lockfile

`bun.lock` = the integration base plus only the new workspaces (`shipping-xpressbees`,
`shipping-ekart`, `shipping-shadowfax`, `shipping-dhl-express`, `shipping-fedex`,
`plugin-growthbook`) and their new external packages (`pdf-lib` in core, already locked;
`@growthbook/growthbook`, `dom-mutator`). Nothing re-resolved. `bun install --frozen-lockfile`
passes.

## Fixes found by the combined checks

- `packages/api/test/order-actions.test.ts`: fixture lacked `customerDetailCard` (Chatwoot).
- `shipping-shadowfax`: fetch wrapper cast to `typeof fetch` (worker typecheck, Bun's
  `fetch.preconnect`).
- DHL Express / FedEx overview pages: destructured `useCopy` so the component-order lint passes.
- `shipping-ekart/src/plugin.ts`: a cp1252 apostrophe re-encoded as UTF-8 (Biome refused the file).
- Formatting / import order in merged files; two dev-side lint nits (money-format test,
  product-tabs test).
