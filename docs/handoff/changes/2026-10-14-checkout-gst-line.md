# Checkout summary: "Includes ₹X GST"

The summary's small line under Total now reads **"Includes ₹X GST"** once the server has worked the amount out.
It falls back to "Inclusive of all taxes" while the total is updating, or when the GST is 0 (gift cards only,
untaxed goods, composition-scheme store).

- `packages/core/src/tax/cart-gst.ts` `previewCartGst`: uses the same rules as placing the order. Each line's
  GST rate (variant, else the store rate), gift cards and untaxed lines at 0, composition stores at 0. The
  discount and any payment-method discount are spread over the lines by `computeOrderGst`. GST sits inside the
  total of goods after discount, plus shipping and any payment fee.
- `apps/storefront/src/lib/gst-actions.ts` `checkoutGstAction`: the store comes from the hostname, the cart from
  the cookie, and lines and rates from the database. The client sends only the total, the reduction and the state.
- `use-checkout-gst.ts` asks 300 ms after the total settles.

**Display only:** the invoice stays the authority. A multi-warehouse order billed from several GSTINs can split
CGST/SGST vs IGST differently, but the total GST is the same.

Stacked on #481 (feat/checkout-delivery).
