# Loyalty points v2 foundation: rewards, tiers, earning rules, referrals, campaigns

Branch `feat/loyalty-v2` (from `153c0e1aa`, on `origin/dev`). Migration `0270_loyalty_v2`
(journal `when` 1795950000000; 0268 and 0269 are taken by other branches). No UI beyond copy
labels for the new history sources. Interfaces for the UI work: `docs/loyalty-v2-interfaces.md`.

## What changed

- Owner's decisions (24 Nov): match the feature set of the Shopify loyalty app he pointed at;
  keep points as store credit (now a setting, default on) and add a rewards catalog; VIP tiers;
  an earning rules framework replacing the hard-coded review and birthday points; referrals
  with a hold for the return window and fraud checks; bonus campaigns; members, analytics and
  emails on the core side.
- Tables (`packages/db/src/loyalty-v2-schema.ts`): `loyalty_member`, `loyalty_tier`,
  `loyalty_tier_change`, `loyalty_earn_rule`, `loyalty_reward`, `loyalty_redemption`,
  `loyalty_referral`, `loyalty_campaign`, `loyalty_notification`; `loyalty_entry` gains nullable
  v2 columns and a wider source check. The migration back-fills members for v1 point holders.
- Core (`packages/core/src/loyalty/`): `balance.ts` (two homes for points, `addPoints`,
  `takePoints`), `member.ts`, `rules.ts` (+ v1 → v2 `ensureEarnRules`), `grants.ts`,
  `rewards.ts`, `redeem.ts`, `tiers.ts`, `campaigns.ts`, `referrals.ts`, `members.ts`,
  `analytics.ts`, `expiry.ts`, `notify.ts`, `shopper.ts`, `daily.ts` (`runLoyaltySweepSteps`),
  `schemas.ts` (browser-safe inputs). `earn.ts` now applies the order spend rule, shipping, GST
  and excluded tags, tier and campaign boosts, and credits in either home. `reminders.ts` is gone
  (replaced by the email queue).
- API: `packages/api/src/routers/loyalty-v2.ts`, `loyalty-v2-members.ts`, `loyalty-common.ts`,
  mounted under `loyalty.*`; four money procedures added to MCP `SENSITIVE_PATHS`; action docs
  regenerated.
- Worker (`apps/worker/src/loyalty.ts`): runs the v2 steps and sends queued `points_expiring`
  (30 and 7 days before) instead of the single v1 reminder.
- App manifest 2.0.0: new hooks `order.paid`, `customer.created`, `customer.updated`; access
  adds discounts (read-write) and orders write (referral order tag). Catalogue regenerated.

Decided here (not by the owner):

- A reward code used on an order stays spent when that order is refunded or cancelled; staff can
  cancel an unused (issued or expired) code to get the points back; store credit rewards cannot
  be cancelled.
- Free product reward = buy-X-get-Y on the product (buy ₹0.01 of it, get one free, once per
  order); a picked variant is stored but the code works on any variant of the product.
- Sign-up points need a storefront session (a checkout-only customer is not a sign-up).
- Tier "points earned" = credited earning less reversals (not redemptions, their refunds,
  expiry, resets). Tier moves down are allowed (rolling window); emails and tier rewards only
  on the first time up to a tier.
- Campaigns: the highest running multiplier wins; fixed bonuses add up; fixed on the entry
  from the order's placed time.
- Referral device check only works when the storefront sends a device id: `order.checkout_device_id`
  is not on dev.
- Expiry emails: 30 and 7 days (points), 30 and 3 days (codes), replacing `reminderDays` (14);
  `reminderDays: 0` still turns them off.

## Tests

- Added (all run here, 68 pass with the v1 suites): `packages/core/src/loyalty/v2-rules.test.ts`
  (pure), `v2-rewards.test.ts` (each reward type, limits incl. parallel redeems, ledger-only
  points, cancel, expiry, shopper view), `v2-earn.test.ts` (v1 → v2 migration, every rule type
  and once-only, order settings, tiers by points and spend, campaigns, expiry recording and
  emails), `v2-referrals.test.ts` (good path, hold window, every fraud check),
  `v2-members.test.ts` (members list, export, import, reset, activity, analytics).
- Typecheck clean: core, db, api, worker, admin, storefront. `packages/api/test/mcp-action-catalogue.test.ts`
  passes. No API-level router test was written.
- Sweeps: no-orphans allow-list has entries for the storefront functions the UI wires next
  (remove them as they get imported). Other sweep failures seen (source-of-truth-header,
  file-size, near-duplicate, service-layer, router-magic-limits v1 `limit.max(200)`) were there
  before this branch.

## Left to do / for the owner to check

- `packages/notifications`: templates for `loyalty_points_earned`, `loyalty_reward_redeemed`,
  `loyalty_reward_expiring`, `loyalty_birthday`, `loyalty_tier_unlocked` (not staged here), then
  add them to the worker's send list.
- UI: admin pages, storefront widgets (call `recordVisit` on signed-in loads, `attachReferral`
  from a `ref` cookie, `grantSignupPoints` after sign-in), email and analytics screens.
- "Points spend as store credit" off does not hide existing store credit points from checkout:
  points already on the balance stay spendable; only new points stay in the ledger.
- On localhost: run `bun run db:migrate` (0270) before starting the worker or admin.
