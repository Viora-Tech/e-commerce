# Unfinished online payments show in All Orders (#1001, #997)

- Before (#849): a storefront checkout whose online payment failed or was abandoned was hidden from All and Cancelled, and only showed in its own tab. The customer page listed it, so the tester saw an order (#2375) that All Orders didn't have.
- Owner decision (31 Oct): show them as payment-pending orders. All and Cancelled now include them, and the row shows Unpaid (plus Cancelled after the unpaid expiry). Unpaid and Unfulfilled still leave them out, so Home's to-do counts don't change.
- The tab is renamed "Payment pending" (`payment_not_finished`, unchanged id).
- Open question: Shopify only makes an order after a gateway payment succeeds; otherwise it's an abandoned checkout. Check against Waimers' Shopify behaviour with Razorpay/Cashfree before deciding on the long-term rule.
