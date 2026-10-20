# The product block shows what an imported theme's product section showed

Branch `feat/product-page-theme-parity`. No migration.

On theme import our `MainProduct` block replaces the theme's `main-product` section (checkout runs
on ours). It used to open with our defaults, so a store like Waimers lost its stars, UPI note,
spec cells, trust badges and accordions. Now:

- **Theme settings carry over** (`packages/core/src/theme-import/main-product-props.ts`, called
  from `toTemplateData` in `import.ts` for the `product` template). The theme's main-section
  blocks in order become `MainProduct` settings: `rating` (and review-app badges), `payment_signals`
  (note, `upi_percent`, offer panel), `stock_bar` / `inventory`, `buy_buttons` (pre-order link),
  `delivery_estimate`, `spec_group` (cells and the spec-table rows), `trust_badges`, `assurance`,
  `accordion` (with `metafield_key`), Dawn's `collapsible_tab`, `returns_line`, `whatsapp_ask`,
  `share`/`share_row`, `description`, and Dawn's vendor `text` block. Parts the theme's buy box did
  not have (stars, vendor, description, share) switch off. A section with no buy-box blocks
  changes nothing. **Already-imported themes need a re-import** to pick this up.
- **Design choice for the specs/trust/accordion blocks:** our own React parts fed by the
  product's metafields, not the merchant's Liquid. Those blocks are `when` branches inside the
  2,000-line `main-product.liquid`, not separate files, so they cannot be rendered on their own
  without rendering the whole section (gallery, form). The theme port already has their markup
  and CSS (`spec-grid`, `trust-badges`, `product-accordion`, `spec-table`), so the result uses the
  theme's classes. New: `product-spec-grid.tsx`, `product-specs.ts` (spec-cells, spec-rows,
  spec-table as pure functions), accordions that fill from `custom.<metafieldKey>` (Specification:
  a written "Label: Value" block as rows, else the spec table; others the field, else the text),
  and the theme's spec icons in `icon.tsx`. Variant-level spec metafields and the `specs`
  namespace are not read; Dimensions shows the field, not the theme's dimension cards.
- **Product data for the block**: `loadProductPageExtras` (`theme-import/product-fields.ts`) loads
  the product's `custom` metafields as text + HTML, the imported `reviews.rating` /
  `reviews.rating_count`, and the breadcrumb collection (first active one by title that is not a
  catch-all such as `all`, `best-sellers`, `sale`, `preorder`). The product page passes them as
  `ProductDetail.fields` / `.collection`.
- **Stars** read real data only: the Reviews app's summary, else the rating imported from
  Shopify. The section's typed `ratingValue` no longer shows on the store (still previews in the
  editor). The average shows beside the stars ("5.0 (1)").
- **UPI price** ("₹6,304 with UPI · How?") comes from the store's checkout adjustment on the
  `manual` (UPI / bank transfer) method when it is a discount (`storeUpiDiscount` in
  `apps/storefront/src/lib/payments.ts`), with the checkout's rounding. With none, a UPI-price note
  hides; a plain note (UPI % 0) still shows as written. The editor still previews `upiPercent`.
- **Swatches**: an option whose every value has its own variant image draws round image swatches
  (`swatchImages`). The radio now sits before its label, which also fixes the selected style of
  the pills (the theme CSS is `radio:checked + label`).
- **Sold out**: the theme's panel (status chip, "Currently out of stock", the back-in-stock form
  when the app is installed) replaces the buy buttons. `notify-me-form.tsx` uses the panel's
  form classes; CSS ported into `section-product.css`.
- **Pre-order**: the buy box already used `product.preorder` (Pre-order button, ship date,
  deposit). The badge in the title now shows only while the selected variant is out of stock.
  Waimers' products showed Sold out because the Shopify import never set pre-order: it now reads
  the variant's inventory policy (`CONTINUE`, "continue selling when out of stock", which Shopify
  pre-order apps use; CSV `Variant Inventory Policy`) and turns `preorderEnabled` on when a tracked
  variant sells past zero (`preorderFrom` in `write-products.ts`). **Re-run the product import**
  for existing stores. The pre-order app's ship date and message are not imported.
- **EMI**: unchanged; the EMI app's line already shows under the price when the app is installed.
- **Breadcrumb**: Home › collection › product.

Tests: `packages/blocks/test/product-page-parity.test.tsx`,
`packages/core/src/theme-import/main-product-props.test.ts`,
`packages/plugin-shopify-import/src/preorder-policy.test.ts` (all pure, no DB). Lint and build
were not run (owner's request); `tsc` is clean for blocks, core, importer, storefront and admin.
