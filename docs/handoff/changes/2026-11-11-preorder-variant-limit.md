# Pre-order limit per variant (#1536)

Branch `feat/preorder-variant-limit`. No migration: the limit lives in the existing
`variant.preorder_override` jsonb (`limit` key).

- Admin: Variants, Edit (variant dialog) has a **Pre-order limit** field, shown while the product
  takes pre-orders (its switch or a campaign) and the variant allows pre-order. Blank uses the
  product's limit; the placeholder says which ("Uses product: 20", "No limit", "Uses the
  campaign's limit"). Form state: `preorderLimit` on `VariantRow`, `validVariantLimit`,
  `inheritedPreorderLimit`, `variantPreorderContext` in `components/products/form-state.ts`.
- Save: `VariantInputSchema.preorderLimit` (int 1 to 1,000,000, null clears, undefined leaves).
  `variantRow(input, current)` now merges onto the stored override through
  `nextVariantPreorderOverride` (`preorder/settings.ts`), so a save never drops override keys it
  does not edit. Before, every save that sent `preorderAllowed` rewrote the override from scratch.
  `products.get` returns `variants[].preorderLimit`. `products.save` (and the MCP's generic
  `runAction` on it) accepts it.
- Precedence (`resolvePreorderSettings`): variant `limit`, then the campaign's (unless the product
  keeps its own limit), then the product's. Every limit counts units sold past stock for one
  variant; no product-wide total. An override `limit: null` now means "use the product's", as the
  function's doc always said (it used to mean "no limit"; nothing wrote it).
- Enforcement needed no change: cart (`cart-room.ts`), `placeOrder` (`routeAndReserve` refuses
  with `OutOfStock` past the limit), draft orders (`draft-preorder.ts`), inbox panel and the
  Pre-orders overview all resolve settings with the variant's override already.
- Merchant guide: `products/pre-orders.mdx`, "A limit for one variant".
- Not done: no column in the bulk editor sheet. Browser check of the dialog still owed.
- Noticed, not changed: `PreorderLimitReached` (errors.ts) is never thrown, routing throws
  `OutOfStock`; `previewCartParcels` (parcel-view.ts) resolves without the campaign (preview only);
  the checkout reservation counts the pre-order limit at the home location while the cart stepper
  counts across locations (stricter at checkout with stock in several locations).
