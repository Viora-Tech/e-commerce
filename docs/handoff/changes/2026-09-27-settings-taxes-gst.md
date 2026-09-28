# Settings → Taxes & GST

**Settings → Taxes & GST** (27 September 2026, `feat/taxes-gst-settings`, no migration): tax
moved off Settings → General into `/settings/taxes` (`components/settings/taxes/`, copy in
`data/taxes.ts`). General keeps a pointer card at `#tax` and redirects `/settings/general#tax`
client side. Fields and where they are stored, nothing twice: GSTIN (validated with
`@commerce/core/gstin`, state shown from the first two digits) and default rate are the
existing `store` columns; legal name, registered address, default HSN and the domestic
tax-invoice series (prefix, next number, new `resetEachYear`) are the GST invoices app's own
`invoice_settings` row and `invoice_sequence` counter (read and written even when the app is
not installed; the page says so); "Prices include GST" and "Composition scheme" live in
`store.apps.settings.core.tax` (`parseStoreTax`/`withStoreTax`, `@commerce/core/tax-settings`).
Composition: checkout charges 0% (`chargedGstRate` in `placeOrder`), invoices print "Bill of
Supply" with the rule 5(1)(g) note (`snapshot.composition`). Series with
`resetEachYear: false` count on counter row `fy_start_year = 0`; `nextNumberFloor` takes the
max of both counters so toggling never reuses a number. API: `taxes.get` / `taxes.save`.
**Not built**: adding GST on top of prices at checkout (the switch is stored and explained,
checkout still extracts GST from the price), and e-invoicing/IRN (the page says so).
Merchant guide: `merchant-guide/settings/taxes`.
