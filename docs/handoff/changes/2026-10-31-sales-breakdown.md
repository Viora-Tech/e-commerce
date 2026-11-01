# Analytics: sales breakdown (audit #100)

- The Analytics overview has a Sales breakdown card, laid out like Shopify's: Gross sales → Discounts → Returns → Net sales → Shipping charges → GST (included in prices) → Total sales.
- Each line shows this range and the period before it.
- Cancelled, draft and test orders are left out. Refunds count when they were made. GST is shown as included because prices in India include it, so total = net + shipping.
- Code: `packages/api/src/services/sales-breakdown.ts` (pure `breakdownLines` plus the sums query), returned as `salesBreakdown` by `analyticsOverview`. Test: `packages/api/test/sales-breakdown.test.ts`.
