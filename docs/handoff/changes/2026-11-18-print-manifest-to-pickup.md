# Print manifest in Shipments › To be picked up

Owner, 18 Nov 2026: staff need a printed list of the parcels in To be picked up to hand the
courier's pickup executive. Before this, a manifest was only a database row
(`shipment_manifest`, made by Create manifest or with each pickup); nothing printed it.

- **Where**: Orders → Shipments › To be picked up (and a courier app's Shipments page, same tab).
  - **Print all manifests**: beside the tab pills (`views` slot of the table), shown when the tab
    has rows. Prints every parcel in the tab (status `created`, on a pickup), one section per
    pickup; on the workspace it follows the panel's Courier filter, on a courier app its courier.
  - **Print manifest**: in the selection bar (`shipments-bulk-actions.tsx`, `tab === 'toPickUp'`),
    for the ticked rows, next to Create manifest.
  - `shipment-row-menu.tsx` and `shipment-columns.tsx` are untouched.
- **API**: `shipments.manifestSheet` (`ORDERS_FULFIL`, `heavy('export')`), input
  `{ shipmentIds?, provider? }`, returns `{ file (PDF), manifests, shipments, created }`. Lives in the
  new `packages/api/src/routers/shipments-print.ts`, spread into `shipmentsRouter`; `labelSheet`
  moved there unchanged (shipments.ts was at 499 lines). MCP docs entry added by hand to
  `action-docs.generated.ts` (regenerate with `bun scripts/gen-mcp-action-docs.ts` to confirm).
- **Service**: `printManifestSheet` (`services/manifest-sheet.service.ts`) reads the parcels with the
  store in the filter (cancelled ones left out), groups them per courier pickup, and for each group
  reuses the newest manifest holding exactly those shipment ids with that courier, else inserts one
  (`created` counts those). The manifest made with Create pickup is the one a "Print all" finds.
- **PDF**: `renderManifestSheet` (`packages/core/src/shipping/manifest-pdf.ts`, pdf-lib, standard
  Helvetica, A4): per pickup a header (courier, with the carrier for an aggregator booking such as
  "Shiprocket (Blue Dart)"; pickup date; pickup place; store; printed time in IST; manifest ref =
  first 8 of its id), a table (#, AWB, order number, ship-to name, city and PIN, weight in kg, COD
  amount or Prepaid), the count line (total parcels, COD parcels and amount, prepaid, weight) and
  signature lines for the store and the courier's pickup executive (name, signature, date and
  time). Long lists run onto more pages with the header repeated; pages are numbered. COD amount is
  the booked `cod_amount_paise`, else the order total for an older COD label.
- **Rules** (pure, `@commerce/core/manifest-sheet`): `groupManifestRows`, `findManifestFor`,
  `sameShipmentSet`, `manifestTotals`, `MANIFEST_SHEET_MAX` (500).
- **Copy**: `apps/admin/src/data/manifest-sheet.ts` + Hindi `data/hi/manifest-sheet.ts`. The PDF
  itself is English: the standard PDF font has no Devanagari or rupee sign, so amounts print as
  `Rs.` and a name typed in Devanagari prints as `?`. Embedding a Unicode font is the follow-up if
  that matters.
- **Admin helpers**: `use-manifest-sheet.ts` (opens a tab on click, then shows the PDF), and
  `showFile` moved out of `use-label-sheet.ts` into `show-file.ts` so both hooks share it.
- **Tests** (not run here: no node_modules in the worktree): `packages/core/src/shipping/
  manifest-sheet.test.ts` (grouping, exact-set reuse, totals, cells, a 3-page render) and two
  cases in `shipments-bulk-actions.test.tsx`. The PDF code was run once by hand against pdf-lib
  1.17.1 (3 pages, A4, cells and totals as expected).
- Merchant guide: Orders → Shipments, "Pickups and manifests" paragraph added.
