# Cashfree connector finished

**Cashfree connector finished** (27 September 2026, `feat/cashfree`, no migration): the
connector itself (`packages/payments-cashfree`, guided Connect page under Apps, merchant guide)
was already on main from 26 September. This pass re-checked hosts, headers, API version
`2026-01-01` and the webhook signature against Cashfree's official Node SDK (`cashfree-pg`
6.0.6; cashfree.com is blocked from the cloud build machines), added a 15-minute replay window
on webhook timestamps (`CASHFREE_WEBHOOK_TOLERANCE_MS`), and made the older product-page EMI
hint show for Cashfree stores too (`gatewayOffersEmi` in `@commerce/core/payment-methods`;
hint copy no longer names Snapmint). Still to do by hand: a sandbox run with real Cashfree
test keys on a https worker URL, to confirm the webhook timestamp unit (we accept ms or s).
