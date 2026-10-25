# Shoppers see "Ships in 2 parcels"; drafts billed like checkout

**Branch** `feat/parcels-shopper`, from `dev` after #386. **Migration
`0104_parcel_delivery_estimate`**: `fulfillment_order.delivery_estimate` (`{ earliest, latest }`
civil dates). PR 6b of the split-across-warehouses plan.

- **Checkout**: `checkoutShipping` returns `parcels` when the cart would split
  (`previewCartParcels` in core, routing without locks; storefront `checkoutParcels` asks the
  courier for each warehouse's estimate, `estimateForPincode(..., originPincode)` with its own
  cache key). `CheckoutParcels` shows them under the delivery choice. The place action passes the
  shown windows (`deliveryEstimates`, by location) to `placeOrder`, which stores them per parcel.
- **After paying**: thank-you page (`CheckoutParcels`), account order page (`OrderParcels`,
  `ShopperOrderDetail.parcels`), order emails (`TemplateData.parcels`, `ParcelsBlock`) list each
  parcel's items, origin city and window. One parcel: nothing changes anywhere.
- **Drafts**: `convertDraft` now bills like checkout (`taxParcels`, new
  `packages/core/src/order/parcel-tax.ts`, also used by `placeOrder`): per-parcel GST and money,
  order tax, GSTIN and tax origin.
- Browser check on the `commerce_gstcheck` copy: checkout preview (light/dark), a real order placed
  through the checkout form (COD) landing on a thank-you page with both parcels and dates, and the
  order email rendered from that order. The account order page was not opened (needs a shopper
  login); its component is the same mapping, covered by `lib/parcels.test.ts`.
