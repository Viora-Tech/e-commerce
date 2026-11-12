# ₹99 Shipping rate charged as ₹99; invoice card shows the discount like the PDF (12 Nov 2026)

- Delivery options priced from the Shipping rate (`price.source: 'zone'`) rounded the typed rate up
  to the next ₹10, so Waimers' ₹99 India rate charged ₹100 (order #2468). `priceRoute` now keeps a
  typed rate as is; only an engine-made price (courier cost + markup, or rate + insurance) is
  rounded. Test: `parcels.test.ts` "the rate exactly as typed".
- GST invoices › invoice page › "Items and GST": lines are already net of the discount, but the
  card listed "Discount −₹100" with no Gross, so its rows did not add up to the invoice total. It
  now shows Gross → Discount (label) like the PDF, and a per-line Discount column. The PDF was
  already right.
