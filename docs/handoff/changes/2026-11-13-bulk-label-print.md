# Print a batch's labels as one file (13 Nov 2026)

Figma 909:9249, the bulk result's Print card. "Print N labels" used to open each courier's
label in its own tab, in the courier's own size. It now makes ONE PDF on the paper the member
picks:

- **4 × 6 in thermal · 1 per page** (default): each label page scaled to fit 101.6 × 152.4 mm,
  shape kept, centred; a landscape page is turned when that prints it larger.
- **A4 · 4 per page**: 2 × 2 grid, 5 mm margin and gap, each label fitted in its slot.
- **Courier's own size**: pages copied unchanged (the old output, in one file).

The choice is remembered per member and store in browser storage
(`scopedStorageKey('shipments.label-paper:v1')`), not as a store setting: the paper follows the
printer on the desk, two packers can differ, and it needs no schema or settings form.

The same picker and one-file print replace the per-tab print on the Shipments selection bar
(`shipments-bulk-actions.tsx`, every booked tab).

## Back end

- `shipments.labelSheet` (ORDERS_READ like the single label, `heavy('export')`): `{ ids (1–100),
  format }` → `{ file: File | null, printed, skipped: { shipmentId, orderNumber, reason }[] }`.
  File name `labels-YYYY-MM-DD.pdf`.
- `services/label-sheet.service.ts`: rows read with `shipment.store_id = caller's store` (and RLS);
  each label the way "Print label" gets it: private storage copy, else the courier's `getLabel`
  (Delhivery), else the courier's public link via `safeFetch` (SSRF guard, 15 s, 10 MB cap).
  Four fetched at a time. Skips: `not_found` (other store / unknown), `cancelled`, `no_label`,
  `failed`, `unreadable`; the admin shows them in a toast ("2 labels left out: #1047 …").
- Core: `label-sheet-layout.ts` (pure maths, subpath `@commerce/core/label-sheet-layout`),
  `label-sheet.ts` (`mergeLabelSheet`, pdf-lib loaded lazily; PNG/JPEG labels accepted; blank
  pages left out), `label-collect.ts` (`collectLabelFiles`: order kept, four at a time, skips
  named), `shippingLabelReader` in label-store.ts. `pdf-lib` added to packages/api devDependencies
  (tests generate small PDFs).
- MCP: `shipments.labelSheet` is a read; skipped in the cross-store walk (courier calls).
- No migration.

## Open

- A courier whose "label" is an A4 page with the label in one corner prints that whole page
  shrunk onto 4 × 6; cropping needs per-courier knowledge.
- Labels fetched inside the request's transaction (as the single label route does); 100 slow
  courier links could take a while.
