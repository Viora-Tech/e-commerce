# Affiliates: signup page, affiliate dashboard, commission fixes (26 October 2026)

Branch `feat/affiliates-2026-10-26`. No migration.

## Signup (`/affiliate`, storefront)

- Landing built from the program's settings: "Earn 10% on every sale" / "₹150 on every order",
  "Up to X%" from levels and tiers (`programRate`), the merchant's pitch, perk chips and three
  steps. `ProgramTerms` states the rules in plain words (rate, first order vs lifetime, link
  window, hold, minimum payout, TDS) with the merchant's terms text.
- Shorter, clearer form: name, main profile, "Where will you share?" chips (`PROMOTE_CHANNELS`,
  stored in `affiliate.answers.promote_via`, shown on the admin page as "Will share on"),
  audience note, the program's own questions, optional UPI ID (saved encrypted with
  `savePayoutDetails` on the new record), terms consent.
- Pending state lists what happens next; rejected shows the merchant's reason.
- Components: `affiliate-landing`, `affiliate-sign-in`, `affiliate-status`, `program-terms`.

## Dashboard

- `link-builder` is now the "Your link" card: copy, `share-buttons` (native share sheet,
  WhatsApp, X, Telegram, Facebook, copy for Instagram), QR, and the product link box.
- Code card with the "code always counts, link needs cookie consent" tip.
- `range-stats`: 7 / 30 / 90 days / all time (`?range=`) for clicks, orders, conversion,
  sales, earned (`portalStats`).
- `balances-card`: pending / ready / paid plus the next payout and what blocks it
  (`payoutOutlook`, which reuses `payoutCandidates` with a new `affiliateId` filter).
- `recent-sales`: masked buyer (`maskBuyer`, "R••• S."), sale, commission, stage
  (`portalSales`). `payouts-list`: history with UTR and breakdown (`portalPayouts`).
- New module `packages/plugin-affiliates/src/portal.ts`.

## Commission flow bugs fixed

1. A payment-method discount (prepaid offer, negative `payment_adjustment_paise`) was ignored,
   so affiliates earned on money the shopper never paid. It now reduces the base like a code.
2. Refund scaling used the order total including shipping and a COD fee, so refunding every
   item while keeping shipping left a commission. Refunds are now measured against the goods.
3. A partial refund on an approved commission left its TDS at the old amount (over-deducted
   in the next payout). TDS now scales with the commission.
4. Clawbacks were tracked by a per-commission `clawback_payout_id` flag; a second refund on a
   commission whose first clawback was already recovered was never won back. Open clawbacks
   are now a ledger: all clawbacks owed less what payouts recovered.

Tests: `packages/plugin-affiliates/test/portal.test.ts` (link click to attribution to
commission, the four fixes, dashboard queries, pure helpers).

## Known, not changed

- Link attribution and click counts need the shopper's analytics consent (the beacon is
  consent-gated). Coupon codes always count. Changing that is a consent-policy decision.
- Commission is not recomputed after an order edit.
