# Affiliates app (built-in, v1)

Branch `feat/app-affiliates`, PR into `dev`. Research and the build-vs-adopt decision:
`docs/research/2026-10-23-affiliate-apps.md` (build: every open-source option is AGPL,
source-available or a Stripe-only SaaS tool). Merchant guide: `apps/docs/content/merchant-guide/apps/affiliates.mdx`.

## Migration

`0158_affiliates` (after `0155_discount_shopify_parity`; prevId is its snapshot, journal `when` later). Tables `affiliate`,
`affiliate_commission` (one per order, `ON DELETE CASCADE` with the order), `affiliate_payout`, all
under RLS, and the SECURITY DEFINER `stores_with_due_affiliate_commissions()` for the worker
sweep. Number 0158 was allocated by the coordinator (0155 discounts, 0156-0157 automations); if one of them lands after this with a later `when`,
regenerate this one so its `when` stays last.

## Where things live

- `packages/plugin-affiliates`: manifest (`plugin.ts`, id `affiliates`, builtin, marketing),
  program settings in `store.apps.settings.affiliates` (`settings.ts`, client-safe), pure maths
  (`commission.ts`, `hold.ts`, `tds.ts`, `fraud.ts`) and services (`affiliates.ts`,
  `commissions.ts`, `payouts.ts`, `stats.ts`, `emails.ts`). Tests: `test/rules.test.ts` (pure),
  `test/flow.test.ts` (DB).
- Hooks: `order.paid` and `order.delivered` credit the order (idempotent; COD credits on
  delivery), delivery starts the hold, `order.cancelled` / `order.rto` reverse, `refund.created`
  shrinks or reverses. New `AppEvent`s `order.cancelled` and `order.rto` (outbox `order.cancelled`,
  `order.cancel_notice` and `order.rto` now fan out to apps). The worker's hourly
  `{affiliates}-commissions` sweep approves due commissions (re-reading the order first) and
  deducts TDS at approval.
- Attribution: `?ref=<code>` is read by `attributionFromVisit` into `Attribution.ref` (channel
  `affiliate` unless UTM-tagged) and rides the existing beacon cookie onto carts and orders, so it
  only works with analytics consent; the beacon also counts the click. Coupon codes always count
  (each approved affiliate gets a percent `discount` row).
- Outbox events: `affiliate.approved`, `affiliate.commission_created`,
  `affiliate.commission_approved`, `affiliate.commission_reversed`, `affiliate.payout_paid`
  (payload `affiliateId`, `commissionId` / `payoutId`, `orderId`). The first, second and last
  email the affiliate (`affiliate_update` template, email only; WhatsApp has a param mapping but
  no approved template).
- API: `packages/api/src/routers/affiliates.ts` (`marketing.read` / `marketing.write`; the bank CSV
  needs `settings.manage`). MCP: `affiliates.payouts.exportCsv` is excluded, `markPaid` and
  `create` are sensitive.
- Admin: `apps/admin/src/components/apps/affiliates/*`, copy `data/affiliates.ts` + `data/hi`.
- Storefront: `/affiliate` (`app/-s/[storeId]/affiliate/page.tsx`): pitch, apply form for a
  signed-in shopper, status, then the dashboard (link, code, figures, recent sales, payout
  details form). Actions in `lib/affiliate-actions.ts`; payout details encrypted with
  `encryptSecret` and never logged; only a masked hint is shown anywhere.
- Pricing: `APP_PRICING.affiliates` included from Growth, ₹299/month below. The sales store needs a
  product with SKU `app-affiliates-month`.

## Also in this PR

- **Theme block** `affiliates/AffiliateSignup` (heading, text, button to `/affiliate`), in the
  manifest and `commerce.blocks.config.ts`; the component is `AffiliateSignupBlock` in
  `packages/blocks/src/app-blocks`.
- **WhatsApp**: `affiliate_update` is on both channels in the message catalogue. The worker sends
  through `deliverMessageTo` (core, new: email to the address, WhatsApp to the phone on the
  affiliate's store account). The merchant creates a WhatsApp template named `affiliate_update`
  with four parameters: store, what happened, amount or code, dashboard link.
- **Key rotation**: `bun run rotate-secrets` re-encrypts `affiliate.payout_details`
  (`AFFILIATE_CIPHER_COLUMNS`) and recomputes `affiliate.phone_index` from the customer phone
  (`refreshAffiliatePhoneIndexes`), in the same transaction per store.
- **Privacy erase** (`anonymiseCustomer`): the affiliate row keeps its commissions and payouts
  but loses name, email, phone index, application text, note, payout details, PAN flag and the
  account link. It is suspended and its discount code is switched off. As a buyer, their
  commissions lose the customer link.
- **Clawback**: a commission already in a payout (paid or waiting) that is then cancelled,
  RTO'd or refunded gets `clawback_paise` (all of it, or the refunded share). The affiliate's next
  payout subtracts it (`affiliate_payout.clawback_paise`, and the commission's
  `clawback_payout_id` marks it recovered). Cancelling that payout puts the clawback back. TDS
  for the year is recomputed on commissions still standing.
- **Storefront Hindi**: the storefront has no language mechanism (no `data/hi` and no locale
  switch), so `/affiliate` and the block are English like the rest of the storefront. Admin
  copy has Hindi.

## Not in v1

No money moves (no payout API); no GST invoices from affiliates; no TDS filing or Form 16A; no
MLM; no creator marketplace.
