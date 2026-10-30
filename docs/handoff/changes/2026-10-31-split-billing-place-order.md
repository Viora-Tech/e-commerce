# Split billing/service.ts and order/place-order.ts (2026-10-31)

Fixes #973. A pure refactor with no behaviour change: every public export keeps its import path
(`./service`, `./place-order` and `@commerce/core` re-export what moved).

## billing (932 → 716 lines)

- `packages/core/src/billing/usage-billing.ts` (new): `runUsageBilling`, `runUsageReminders`,
  `markUsageBillPaid`, `cancelUsageBill`, `UsageBillingResult` and their helpers.
- `service.ts` keeps plan bills, `placeSalesOrder` and the sweep, re-exports the four, and now
  exports `salesOrderUrl` and `usageFeeSku` for the new module.

## checkout (1208 → 479 lines)

- `order/place-order-types.ts`: `CheckoutDetails`, `PlaceOrderInput`, `PlaceOrderResult`, and
  the `Line` and `State` types the steps share.
- `order/place-order-rules.ts`: `checkGiftCardRules`, `paymentAdjustmentFor`, `lineGstRate`,
  `sumPaise`, `chargeNowPaise`, `paidByCards`, and `checkCheckoutPincode` (the PIN spelling,
  the state check and the India Post directory lookup).
- `order/checkout-customer.ts`: `upsertCheckoutCustomer`, the customer upsert by email or phone,
  the address snapshot, GSTIN and marketing consent (was inline in `createOrder`).
- `order/cart-replay.ts`: `lockCartOrReplay`.
- `order/place-order-create.ts`: the `createOrder` workflow step.
- `place-order.ts` keeps the other steps, `placeOrder` and `placeOrderAndPay`. A duplicate
  `productId` key in `loadCart`'s select was dropped (same value).

`scripts/sweeps/file-size.test.ts`: billing lowered to 716, place-order removed from the list.
