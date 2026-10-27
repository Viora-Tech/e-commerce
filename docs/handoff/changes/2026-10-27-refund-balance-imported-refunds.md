# 2026-10-27 — Refund no longer shows a balance due; refunds on imported orders

Fixes #829. Found while testing #830.

- `orderBalance` (api `order-fulfil.service.ts`) now uses `balanceOf`: a refund settles an
  overpayment (an edit that lowered the total) but never puts the customer back in debt. Before,
  a ₹30 goodwill refund on a fully paid order showed "Balance due ₹30" and "Collect ₹30".
- Imported orders (Shopify history): the Payment card's **Refund** is available again, limited to
  "Already sent another way" (UPI, bank, cash, cheque, other) and "As store credit"; the old
  platform took the money, so nothing goes through a gateway here. The `orders.refund` route
  allows imported orders only for `manual` or `store_credit`.
