# Checkout takes the admin's cards, Geist, and neat rows

The left cards use the admin's `surface-card` values and the summary card its sales-hero glass
(`summary-glass.tsx`), white light only. A summary image keeps its own wash instead. Geist joins the
theme fonts and is the checkout's default; a store with a saved font keeps it until changed in
Settings → Checkout. Accent, button and corners stay the merchant's.

A Contact or Delivery card that arrives complete reads as rows with Edit
(`checkout-filled-rows.tsx`). Fields stay mounted while hidden, and focusing one keeps the card
open, so it cannot fold while a shopper types.
