# Pricing revamp (per-order fee, Scale, fair use) and open sign-up

Branch `feat/mirofish-findings`. Design: `docs/superpowers/specs/2026-10-28-pricing-revamp-design.md`;
plan: `docs/superpowers/plans/2026-10-28-pricing-revamp.md`; decisions: `memory-bank/pricing.md`.

## From the MiroFish launch simulation (first commits)
- **Open sign-up:** the waitlist is gone from the site; every "Start free" goes to the admin
  sign-in. `MERCHANT_SIGNUP_MODE` now defaults to `open` in the app itself (prod runs as Dokploy
  apps, so the compose default never applied); setting `invite` still closes it.
- Honest copy: GST-inclusive price on plan cards, "Coming soon" on subscriptions, downloads and
  services, COD control and data-export FAQ answers, WhatsApp billed by Meta directly.
- A sample GST tax invoice PDF on the GST invoicing page
  (`packages/invoices/scripts/sample-documents.ts`). The credit-note sample is held back by #872.

## Pricing (owner, 2026-10-28)
- **Plans:** Starter ₹499 / 50 orders / 1%, Growth ₹1,999 / 200 / 0.75%, Pro ₹4,999 / 500 / 0.5%
  (AI 8,000 credits), new **Scale** ₹14,999 / 2,000 / no fee ever. Own it unchanged, "Talk to us".
- **Migrations:** `0178_scale_plan` (plan check constraints) and `0179_usage_bill` (`usage_bill`,
  `store_plan.fair_use_notice_month`, `usage_bill_store`, `stores_with_paid_period`), and `0180_usage_bill_reminders` (`reminders_sent`, `stores_with_due_usage_bills`).
- **Per-order fee:** `billing/usage-fee.ts` (pure), `usage-fee-service.ts` (inputs, estimate,
  CSV), `runUsageBilling` / `markUsageBillPaid` / `cancelUsageBill` in `billing/service.ts`, run
  by the hourly billing sweep and the outbox relay. Unpaid fee bills ride on the next plan bill
  (`createPlanBill`, which claims them in one transaction and bills the plan alone if the fee
  product is missing); a cancelled or replaced plan bill gives them back as owed. They never
  pause a store; `runUsageReminders` emails them 3 and 7 days after billing. Developer docs "Plans and billing" → "Per-order fees".
- **Fair use:** `billing/fair-use.ts`, same sweep; the storefront beacon now skips bots.
- **Admin:** Plan & billing shows this month's fee estimate, a Per-order fee bills card (Pay,
  CSV), unpaid-fee and fair-use banners, fee and visit rows plus Scale in Compare plans; the
  sidebar warns at 80% and 100% of included orders. English and Hindi.
- **Site:** four plan cards, Own it band, a calculator of plan + fees (`billing/cost-estimate.ts`),
  new compare rows, FAQ, Terms and every "0% transaction fee" claim rewritten.
- **Regional prices** stored in `billing/regional-prices.ts`, off (`REGIONAL_PRICING_LIVE`).

## Before release: sales-store setup (owner)
Without these the new plans and fee bills can't be paid (`BillingNotReady`, the sweep retries):
- Growth variants priced **₹1,999 / ₹19,990**; check Pro still reads ₹4,999 / ₹49,990.
- New product **Scale**: SKUs `plan-scale-month` ₹14,999 and `plan-scale-year` ₹1,49,990.
- New product **Per-order fees**: SKUs `usage-fee-starter`, `usage-fee-growth`, `usage-fee-pro`,
  `usage-fee-carried` (any price, the bill sets it), stock not tracked, taxed at 18% like plans.

## Left
- Admin Plan & billing not yet checked in a browser (no local admin here); check on vioratech.in.
- Stripe/PayPal before any regional price goes live.
