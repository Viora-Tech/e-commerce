# Landed cost step 3: profit per order, product and month

**Branch** `feat/order-profit`, from `dev` after #391. **Migration `0105_order_profit`**:
`order_line.cost_at_sale_paise` + `cost_estimated`, `shipment.courier_charge_paise`,
`payment.fee_paise`; backfill fills cost at sale from today's variant cost (estimated) on placed
orders.

- **Formula** (`packages/core/src/order/profit.ts`, PROFIT_FORMULA, pure, `@commerce/core/profit`):
  net sales ex GST (cancelled/RTO orders: only money collected) − goods at cost at sale (restocked
  units excluded) − courier charges − gateway fees (reported fee, else store rate; COD: courier COD
  fee) − RTO costs. Unknowns count as 0 and are flagged.
- **Facts** (`profit-service.ts`): `profitFacts` (bulk, chunked), `orderProfit`,
  `setCourierCharge`, `profitCostsView` / `saveProfitCosts` (rates in
  `store.apps.settings.core.profit`).
- **Snapshots**: `placeOrder` stores `cost_at_sale_paise`; `convertDraft` sets it at conversion;
  courier bookings store `chargePaise` when the courier answers with it (the demo courier does).
- **API**: `orders.profit` (analytics:read), `orders.setCourierCharge` (orders:write),
  `profitCosts.get/save`; reports `profit-by-month`, `profit-by-product` (Finance).
- **Admin**: order page Profit card (with courier charge field), Settings › Costs for profit
  (`/settings/costs`, gateway fees for enabled methods + COD fee). Copy in `data/orders.ts`,
  `data/profit-costs.ts`, `data/analytics.ts` (+ Hindi).
- **Not done**: real couriers (Delhivery, Shiprocket) do not yet pass their booking charge;
  gateways do not yet write `payment.fee_paise` (both fall back as described).
