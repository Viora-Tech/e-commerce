# 2026-10-31: bulk edit issues (#985, #984, #1000, #999, #998, #982)

From the tester's reports on the test server.

## Products bulk edit (`/products/bulk-edit`): #985, #984

- One row per product. A product with several variants is a product row with a chevron that
  shows its variant rows; "Show variants" / "Hide variants" in the header does all of them.
  Products with one variant stay one row. #984 has no text, but its screenshot is the same
  sheet showing 19 variant rows for 4 products, so this fixes it too.
- On a product row, product cells edit the product and a variant cell (price, SKU, weight…)
  sets that value on every variant. Cells where the variants differ show "Mixed", or a price
  range such as "₹999 – ₹1,299". Stock on a product row is the read-only total. On a variant
  row only the variant cells edit; product cells are blank.
- "Change for all": pick a column (price, compare-at, both, cost, status, vendor, type, tags),
  what to do (increase or decrease by an amount or a percentage, set, clear, add/remove tags)
  and whether it applies to every row or the ticked rows. A ticked product row means all of
  its variants. Prices never go below ₹0; a variant without a price stays without one. Nothing
  is saved until Save.
- Code: `components/products/bulk-edit/bulk-edit-view.ts` (shown rows, mapping edits back to
  the variant rows), `bulk-edit-set-all.ts` (the price math, through `@commerce/money`),
  `bulk-set-all-dialog.tsx`. Tests: `bulk-edit-set-all.test.ts`.

## Customers bulk edit (`/customers/bulk-edit`): #1000, #999

- "Change for all" already existed here (since 22 Oct); what the products sheet had and this
  one lacked was the Columns menu, so #1000 adds it (remembered per browser). SMS and WhatsApp
  consent columns start hidden when the store cannot send on them yet, but can be switched on.
- SMS and WhatsApp: "Change for all → Subscribe everyone" skips customers without a phone; a
  typed "Subscribed" on a customer without a phone is flagged before Save.

## Customers list bulk bar: #999, #998

- Marketing menu offers email, WhatsApp and SMS, subscribe and unsubscribe. Channels not set
  up yet are marked; consent is still recorded with its timestamp and history row.
- Server: `setMarketingConsent` takes `needsContact`; `customerPrivacy.setConsentMany` sets it,
  so a bulk grant skips customers with no email (email) or no phone (SMS, WhatsApp).
- #998 "add a save feature to the bar": read as saving the selection. "Save as segment" asks
  for a name, tags the ticked customers with it and saves a segment `tag = <name>`, because a
  segment is a saved rule, not a fixed list. The toast links to the segment.

## Product page collection picker: #982

- "Create collection" under the picker opens a dialog (title only), creates a manual collection
  and selects it. On a saved product the card's Save adds the product; on a new product it is
  saved with the product.

## How to test

1. Products → tick 4 products with variants → Bulk edit: one row each; expand one; type a price
   on the product row (all variants change); Change for all → Price → Increase by a percentage
   → 10 → Ticked rows; Save.
2. Customers → tick some → Marketing → Subscribe to SMS (customers without a phone skipped).
3. Customers → tick some → Save as segment → name → open the segment from the toast.
4. Customers bulk edit → Columns → turn on SMS marketing → Change for all → Subscribe everyone.
5. A product → Collections → Create collection → title → it is picked → Save.
