# Shipping profile rows: price and stock back, thumbnails aligned (8 Nov 2026)

Found while testing #1310 on the live admin. The per-variant rows on a profile page had lost
each product's price and stock line (the old picker list showed "₹1,499 · Out of stock"), and
products with one variant had no chevron, so their thumbnails sat left of the others.
- `profile-products-card.tsx` fetches the same line through `loadPicked` (as the product picker
  does). It refetches only when the listed products change, not on every tick.
- `profile-product-row.tsx` shows "All variants · ₹150–₹800 · 157 in stock" and keeps a
  chevron-wide spacer for single-variant products.
