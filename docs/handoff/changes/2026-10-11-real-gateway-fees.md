# Real gateway fees for profit (2026-10-11)

Branch `feat/real-gateway-fees`. Profit now uses the fee Razorpay or Cashfree actually kept per payment; Settings → Costs for profit rates are only a fallback, set by how the customer paid.

- Migration `0116_payment_fees`: `payment.fee_tax_paise`, `payment.method_detail` (jsonb), `payment.fee_checked_at`, partial index `payment_fee_unknown`, SECURITY DEFINER `stores_with_unknown_payment_fees()`.
- Contract (`@commerce/payments`): `PaymentCharges` / `PaymentMethodDetail`; optional `charges` on `payment.captured`; new `payment.charges` event; optional read-only `PaymentProvider.fetchCharges`.
- Adapters: Razorpay `charges.ts` (payment entity `fee` incl. GST, `tax` = GST, `method`, card type/network/sub_type/international; `fetchCharges` = payment fetch with `expand[]=card`). Cashfree `charges.ts` (method from `payment_group` + `payment_method`; fee from `PAYMENT_CHARGES_WEBHOOK` or the order settlement `pg_service_charge + pg_service_tax` (+ forex), 0 when `charged_to` CUSTOMER). Decentro records `{ kind: 'upi' }`, no fee.
- Core `payments/charges.ts`: `recordPaymentCharges` (webhook + sync), `syncPaymentFees` (90 days, newest first, 250 ms pause, one short tx per write, 6 h recheck), shopper-paid surplus taken off (`merchantFee`).
- Profit (`order/profit.ts`): actual fee → method rate (`methodFees`, Razorpay/Cashfree payments only) → gateway rate → flagged missing. Rates are before GST; +18% GST unless the store has a regular, live GST registration (or a legacy `store.gstin`), in which case actual fees drop their `fee_tax_paise`. `OrderProfit.feeSource` = actual / estimated / mixed.
- `methodFees` defaults to Razorpay's standard rates (razorpay.com/pricing, read 2026-10-11: 2% domestic, 2.15% corporate/business, 3% international) until a store saves its own; old saved settings get them too.
- Behaviour change: legacy `gatewayFees` / `codFee` now count as before-GST, so a store without a GSTIN sees 18% more on estimated fees than before.
- Worker: `{payments}-fees` repeat job every 30 min (`apps/worker/src/payment-fees.ts`); one-off `bun run --cwd apps/worker fees:backfill [--store id] [--days 90]` (in the container `bun src/payment-fees-backfill.ts`).
- Admin: Settings → Costs for profit has "Fees by how the customer paid" (with "Use standard rates" and a GST note), "Fees by gateway", COD. Order Profit card shows "Payment fees · Actual / Estimated / Partly estimated". Hindi copy added.
- Docs: merchant guide `settings/costs.mdx`, `analytics/profit.mdx`; developer `data-model.mdx` (Gateway fees, Profit, migration table), `plugins.mdx`.
- UNVERIFIED (no live gateway calls): Razorpay customer-fee-bearer amounts, Cashfree `service_charge_discount`, Cashfree settlement response before settlement (404 treated as "not yet"). Cashfree's charges webhook needs "Success Payment TDR" ticked in its dashboard; the sync covers it otherwise.
