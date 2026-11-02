# Customer segments: 8 more filters and "is between" (#1020)

- `core/customers/segments.ts`: new fields aov, city, customer_days, first_order_days, product
  (bought / did not buy), cod_orders, rto_orders, abandoned_cart (30 days); new op `between`
  ("min,max", inclusive, open on an empty side) for number fields. Facts that are not on the
  customer list row are optional on `SegmentCustomer`; an unloaded fact never matches.
- `core/customers/segment-extras.ts` `segmentExtras(tx, ids|null)`: one loader for city,
  customer since, first order, products bought (order lines → variants), COD orders, RTO return
  requests and abandoned carts. Used by the segment pages, discount eligibility and campaign
  audiences, only when a rule needs it (`needsSegmentExtras`).
- Admin condition row: product picker, Min/Max boxes for "is between" (rupees for money fields),
  Yes/No for abandoned cart. Copy in English and Hindi.
