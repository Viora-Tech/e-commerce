# Pre-order note (#936) and pre-order per variant (#962)

Branch `fix/preorder-parity`. Migration **0189_preorder_note** (after 0187 bug reports #960 and
0188 role approvals #958; delivery options #959 re-chains if it merges second): `product.preorder_note` and
`order_line.preorder_note`, both nullable text.

## Pre-order note (#936)

- Store default: `store.preorder.note` (jsonb, `PreorderStoreSettingsSchema.note`), edited in
  **Settings → Payments → Advanced → Pre-orders → Pre-order note** (`preorder-note-settings.tsx`,
  `store.updatePreorderNote`). `store.updatePreorder` (the balance card) never changes the note.
- Per product: `product.preorder_note`, the **Pre-order note** field in Pre-order & launch.
  Blank uses the store's.
- `preorderNoteText` (`@commerce/core/preorder`, `preorder/note.ts`) picks product over store
  and fills `{ship_date}` ("30 November 2026") and `{ship_month}` ("November 2026") from the
  resolved ship date, store time zone. A note naming the date on a product without one is not
  shown (null).
- Shown: under the buy button on our themes (`product-buy-buttons.tsx`, replaces "Available
  for pre-order" when set), under an imported theme's `/cart/add` form
  (`components/theme/liquid-preorder-note.tsx`, follows the form's `id` field), cart lines
  (`CartLineView.preorderNote`), checkout summary, thank-you summary, order emails
  (`TemplateData.lines[].note`). The order line snapshots the note at placement
  (`order_line.preorder_note`).
- Shopify import: Essential Pre-Order keeps campaigns in app-owned metafields, but its app
  embed writes them into every storefront page as `preorder-app-data`. `preorder-campaigns.ts`
  reads the home page once (primary domain, then myshopify), maps variant id → message; the
  product takes the message as its note. Literal text, so a fixed month in it does not follow
  the ship date.

## Pre-order per variant (#962)

- `resolvePreorderSettings`: `enabled = product.preorderEnabled && override.enabled !== false`.
  A variant override can no longer switch pre-order on for a product that has it off (no writer
  ever set that; the one test that did was updated).
- The variant's **Allow pre-order** switch (variant dialog, **No pre-order** chip in the table)
  is `variant.preorder_override = { enabled: false }`; on stores no override. `VariantInput.preorderAllowed`
  writes it (`withPreorderAllowed`), `getProduct` returns `preorderAllowed`.
- Storefront: `ProductDetail.variants[].preorder`, `variantOnPreorder()` (blocks) decides the
  pre-order state per picked variant. The product's pre-order details come from the first
  variant that sells on pre-order.
- Variant picker crosses out a value when no buyable variant has it with the other picked
  values (`valueUnavailable`), Shopify-style (Air+ crossed with Black picked).
- Server: `addToCart` now refuses a tracked, sold-out variant that is not on pre-order
  (`OutOfStock`); `placeOrder`'s stock reservation already refused it.
- Imported themes: `variant.available` and the new `variant.inventory_policy`
  (`continue`/`deny`) follow the per-variant rule.
- Shopify import: on a product whose variants' policies make it a pre-order product,
  `inventoryPolicy: DENY` on a tracked variant → Allow pre-order off, `CONTINUE` → on
  (`preorderAllowedFrom`). Essential Pre-Order campaign variants count as `CONTINUE`.
- Hidden variants (#934/#948, `hidden_on_store`) are separate: hidden is not shown at all.

## Owner, for Waimers

Re-run the products import (or set by hand): the ATK Blazing Sky X1 gets its note from the
campaign, and Extreme 2.0 / X1 SE get Allow pre-order off. Set the store default note and the
products' expected ship dates so `{ship_month}` notes fill in.
