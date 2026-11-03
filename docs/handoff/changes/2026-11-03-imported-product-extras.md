# Imported themes: our product-page extras are opt-in; the UPI price is whole rupees and matches checkout (#1049)

On an imported Shopify theme, our `MainProduct` section (which replaces the theme's
main-product) no longer adds what the merchant never placed. Six switches in Customize ›
Product information, each off on an imported theme and on for our own themes:

| Setting | What it draws |
| --- | --- |
| `showEmiHint` | the EMI line under the price (existed) |
| `showTaxNote` | "Inclusive of all taxes" |
| `showSaving` | "Save ₹N" beside the MRP (`Price` takes `showSaving`) |
| `showUpiPrice` | the offer note as "₹X with UPI"; off shows the note as written |
| `showDispatchLine` | the dispatch line (`deliveryText`, the "Ships within 24-48 business hours" card) |
| `showDeliveryEstimate` | the PIN code check (existed; `ProductView` now gates it and the EMI line itself) |

How the default is chosen: `packages/blocks/src/sections/imported-defaults.ts`
(`withImportedDefaults`, subpath `@commerce/blocks/imported-defaults`) puts the imported
defaults under a section's saved props.
- New imports: `theme-import/import.ts` `ourMainSection` writes them into the stored props.
- Themes imported before this: the storefront (`lib/template-render.tsx`, when the theme is
  imported, i.e. `renderLiquidSections` returned a map) and Customize (`normalizeDoc(doc,
  config, record.imported)`) fill them in under whatever was saved. Nothing to migrate; a
  value the merchant saves always wins.

UPI price: still the store's own discount (Settings › Payments, the bank transfer / UPI
method's adjustment, `storeUpiDiscount`), so it is what checkout charges. Checkout's
`paymentAdjustmentPaise` (`core/payments/adjustment-math.ts`) now takes a percent discount off
in whole rupees, half away from zero (₹2,699 at −2% is −₹54 → ₹2,645, not ₹2,645.02); percent
fees keep paise. `upiPricePaise` in blocks mirrors it (blocks does not depend on core); both
tests share one table of cases. Merchant guide: money-and-gst/payments.mdx.

Not changed: the canvas preview without a store discount still previews the section's
`upiPercent` (rounded down to the rupee, as the theme did).
