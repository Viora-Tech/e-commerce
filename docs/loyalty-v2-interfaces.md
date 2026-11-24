# Loyalty points v2: interfaces for the UI work

Branch `feat/loyalty-v2`. Migration `0270_loyalty_v2`. Built 24 Nov 2026 as the foundation for
three UI streams that can run in parallel:

1. **Admin pages** (program setup, members, referrals, redemptions): the `loyalty.*` API below.
2. **Storefront widgets** (rewards panel, ways to earn, tier card, referral link, visit
   tracking): the core functions under "Storefront".
3. **Emails and analytics screens**: "Emails" and `loyalty.analytics` / `loyalty.activity`.

The feature set follows the Shopify app the owner pointed at (features only, own words and
design). Code: `packages/core/src/loyalty/*`, routers `packages/api/src/routers/loyalty*.ts`,
tables `packages/db/src/loyalty-v2-schema.ts`. Every money amount is paise, every percent of a
reward is basis points (1000 = 10%), every multiplier is basis points (12500 = 1.25x).

## The model in one screen

| Piece | Table | Notes |
| --- | --- | --- |
| Points ledger (v1, widened) | `loyalty_entry` | New sources: `rule`, `redemption`, `redemption_refund`, `referral`, `expiry`, `import`, `reset`. New columns: `rule_id`, `earn_key` (once-only, unique per customer), `redemption_id`, `referral_id`, `campaign_id`, `multiplier_bp`, `bonus_points`. |
| Member | `loyalty_member` | One per customer in the program: `tier_id`, `referral_code` (8 chars), `referred_by_id`, visit streak, `joined_at`. Made on first need; v1 point holders were back-filled by the migration. |
| VIP tier | `loyalty_tier` | `threshold` (points earned or paise spent, per `settings.tierBasis`), `multiplier_bp`, `perks[]`, `reward_id` (free on reaching it), `customer_tag`, `colors {background, text}`. |
| Tier history | `loyalty_tier_change` | `from_tier_id` → `to_tier_id`, for the activity feed. |
| Earning rule | `loyalty_earn_rule` | `type`, `key` (platform for `social`), `points`, `settings`, `enabled`, `position`. |
| Reward | `loyalty_reward` | The catalog. |
| Redemption | `loyalty_redemption` | One reward a member took: `points`, `value`, `discount_id` + `code` (or `store_credit_entry_id`), `status` `issued`/`used`/`cancelled`/`expired`, `via` `redeem`/`tier`/`referral`, `expires_at`. |
| Referral | `loyalty_referral` | One per friend: `status` `pending`/`friend_ordered`/`completed`/`rejected`, `reject_reason`, `available_at` (end of hold). |
| Campaign | `loyalty_campaign` | Window, `tier_ids` (empty = all), `bonus_type` `multiplier`/`fixed`. |
| Email queue | `loyalty_notification` | One row per (customer, `dedupe_key`), `sent_at`. |

### Where points live (`settings.pointsAsStoreCredit`, default on)

- **On** (v1 behaviour): credited points are `loyalty` store credit lines; they pay at checkout
  through the existing store credit box. Balance = what is left of those lines.
- **Off**: new points are held only in `loyalty_entry` (no `store_credit_entry_id`) and spend
  only on rewards. Balance = replay of those entries, soonest expiry spent first.
- `pointsSummary()` always returns both homes added up. Redeeming takes ledger-only points
  first, then store credit points.

## Settings (`loyalty.settings.get` / `loyalty.settings.save`)

`LoyaltySettingsSchema` (`@commerce/core/loyalty`, browser-safe). v1 fields stay; v2 adds:

| Field | Type | Default |
| --- | --- | --- |
| `pointsAsStoreCredit` | boolean | `true` |
| `pointsNameSingular` / `pointsNamePlural` | string ≤30 | `point` / `points` |
| `excludeTags` | string[] | `[]` (customers with any tag earn and redeem nothing) |
| `programStatus` | `live` \| `paused` | `live` |
| `testEmails` | string[] (lower-case) | `[]` (the only people in the program while paused) |
| `includeShipping` | boolean | `false` |
| `includeTaxes` | boolean | `true` (Indian prices include GST; v1 counted it) |
| `tierBasis` | `points` \| `spend` | `points` |
| `tierWindow` | `lifetime` \| `rolling_12m` | `lifetime` |
| `referrals` | object | `{ enabled: false, referrerReward: {kind:'points', value:100}, friendReward: {kind:'percent', value:10}, maxPerMember: 0, referrerTag: '', friendTag: '', orderTag: '', codeDays: 30 }` |

A referral reward is `{ kind: 'points' | 'percent' | 'fixed', value }`: points, whole percent
(1 to 90), or paise. v1 fields still used: `expiryMonths`, `reminderDays` (0 turns the expiry
emails off). `pointsPer100`, `reviewPoints`, `birthdayPoints` only matter until the store's
rules exist; saving them on the old settings page also updates the matching rule.

Pure helpers (browser-safe): `pointsLabel(n, settings)`, `programOpenTo(settings, {email, tags})`,
`boostedPoints(base, multiplierBp, bonus)`, `POINTS_EXPIRY_NOTICE_DAYS` (30, 7),
`REWARD_EXPIRY_NOTICE_DAYS` (30, 3).

## Admin API (`loyalty.*`, oRPC)

All procedures answer `PRECONDITION_FAILED` when the app is not installed. Loyalty refusals
carry `data.reason`: `not_found` (404), `invalid` / `insufficient` (400), `not_eligible` (403),
`limit_reached` / `used` (409), `closed` (412).

### v1 (unchanged)

| Procedure | Permission | Input | Output |
| --- | --- | --- | --- |
| `overview` | customers read | `{ days: 7 \| 30 \| 90 }` | `{ days, earnedPoints, takenBackPoints, customers, pendingPoints, recent[] }` |
| `forCustomer` | customers read | `{ customerId, limit≤200 }` | `PointsSummary & { birthday, entries: PointsEntryView[] }` |
| `adjust` | customers write | `{ customerId, points (±, ≠0), reason }` | `PointsSummary` |
| `setBirthday` | customers write | `{ customerId, birthday: 'MM-DD' \| null }` | `{ ok: true, birthday }` |
| `settings.get` | settings read | none | `LoyaltySettings` |
| `settings.save` | settings manage | `LoyaltySettings` input | `LoyaltySettings` |

`PointsSummary = { points, expiringSoon: { points, lastDay: 'YYYY-MM-DD' } | null, pendingPoints }`.

### Earning rules

| Procedure | Permission | Input | Output |
| --- | --- | --- | --- |
| `rules.list` | settings read | none | `EarnRuleRow[]` (makes the v1 rules first for a store with none) |
| `rules.save` | settings manage | `{ id: uuid \| null, rule: EarnRuleInput }` | `EarnRuleRow`; a second rule of a type (or platform) is `invalid` |
| `rules.remove` | settings manage | `{ id }` | `{ ok: true }` |

`EarnRuleInput = { type, key ('' or a social platform), title|null, points, settings, enabled, position }`.
Types and their `settings` (`RULE_SETTINGS` in `schemas.ts`):

| `type` | `points` means | `settings` | Once? | Fires |
| --- | --- | --- | --- | --- |
| `order_spend` | per ₹100 (0 to 100) | `{ excludeProductTags: string[] }` | per order | delivery, credited after the return window |
| `first_order` | bonus | `{}` | once | first counted order delivered, after the window |
| `signup` | bonus | `{}` | once | `customer.created` hook or `grantSignupPoints` after sign-in (needs a storefront session) |
| `newsletter` | bonus | `{}` | once | customer accepts email marketing (`customer.created`/`updated`) |
| `birthday` | bonus | `{}` | once a year | hourly sweep on the birthday |
| `anniversary` | bonus | `{}` | once a year | hourly sweep on the `joined_at` day |
| `daily_visit` | per day | `{}` | once a day | `recordVisit` |
| `visit_streak` | bonus | `{ days: 2..365 }` (default 7) | every `days` in a row | `recordVisit` |
| `product_review` | per product | `{}` | per product | hourly sweep (published review of a delivered product) |
| `google_review` | bonus | `{ url }` | once | `claimActionRule` (honour system, on click) |
| `social` | bonus | `{ url, action: follow\|join\|subscribe\|visit }`, `key` ∈ `LOYALTY_SOCIAL_KINDS` (instagram, youtube, x, facebook, tiktok, pinterest, discord, reddit, telegram, whatsapp, link) | once per platform | `claimActionRule` |

### Rewards and redemptions

| Procedure | Permission | Input | Output |
| --- | --- | --- | --- |
| `rewards.list` | settings read | none | `RewardRow[]` |
| `rewards.save` | settings manage | `{ id \| null, reward: RewardInput }` | `RewardRow` |
| `rewards.remove` | settings manage | `{ id }` | `{ result: 'deleted' \| 'deactivated' }` (redeemed rewards are switched off) |
| `redemptions.list` | customers read | `{ customerId?, status?, page, perPage }` | `{ rows: (RedemptionRow & { customerName, customerEmail })[], total }` |
| `redemptions.redeemFor` | customers write | `{ customerId, rewardId, points? }` | `RedemptionRow` |
| `redemptions.cancel` | customers write | `{ id }` | `RedemptionRow` (status `cancelled`) |

`RewardInput = { type, title, description|null, pointsCost, value, minPoints|null, maxPoints|null,
productId|null, variantId|null, minOrderPaise|null, minTierId|null, usageLimit|null,
oncePerCustomer, codeDays|null (default 90), active, position }`.

| `type` | `pointsCost` | `value` | Gives |
| --- | --- | --- | --- |
| `amount_off` | points | paise | one-use code, fixed off the order |
| `custom_amount_off` | points per step | paise per step | shopper picks `points` (whole steps, within min/max), code worth steps × value |
| `percent_off` | points | basis points | one-use code, percent off the order |
| `free_product` | points | ignored | one-use buy-X-get-Y code on `productId`: one unit free once in the cart |
| `free_shipping` | points | ignored | one-use free shipping code |
| `store_credit` | points | paise | store credit (`adjustment` kind) at once; no code; redemption is `used` |

Codes are ordinary discounts (`REWARD-XXXXXXXX`, usage limit 1, per customer 1, eligibility
`customers: [customerId]`, `min_subtotal_paise` = `minOrderPaise`, ends after `codeDays`), so
checkout's usage limits guard them. `RewardBlock` (why one cannot be taken): `inactive`, `tier`,
`sold_out`, `already_redeemed`, `points`.

**Refund and cancel rule (decided 24 Nov):** an order that used a reward code keeps the code
spent when it is later refunded or cancelled; staff can give points back with `adjust`. Staff can
cancel a code nobody used (`issued` or `expired`) with `redemptions.cancel`: the discount is
switched off and the points come back as a `redemption_refund` entry expiring from today.

### Tiers and campaigns

| Procedure | Permission | Input | Output |
| --- | --- | --- | --- |
| `tiers.list` | settings read | none | `TierRow[]` lowest first |
| `tiers.save` | settings manage | `{ id \| null, tier: { name, threshold, multiplierBp, perks[], rewardId\|null, customerTag\|null, colors\|null, position } }` | `TierRow` |
| `tiers.remove` | settings manage | `{ id }` | `{ ok: true }` |
| `tiers.recalc` | customers write | `{ customerId }` | `{ changed, fromTierId, toTierId }` |
| `campaigns.list` | settings read | none | `LoyaltyCampaignRow[]` |
| `campaigns.save` | settings manage | `{ id \| null, campaign: { name, startsAt, endsAt, tierIds[], bonusType, multiplierBp (≥10000), bonusPoints, active } }` | `LoyaltyCampaignRow` |
| `campaigns.remove` | settings manage | `{ id }` | `{ ok: true }` |

Tier rules: worked out on every credited earn and once a day per member (hourly sweep, store
day). Moving up tags the customer (old tier tags off), grants the tier's reward once, and queues
`loyalty_tier_unlocked` once per tier. Order points = `floor(base × tier multiplier × the highest
running campaign multiplier) + every running fixed bonus`, fixed on the entry at delivery from
the order's placed time.

### Members, referrals, activity, analytics

| Procedure | Permission | Input | Output |
| --- | --- | --- | --- |
| `members.list` | customers read | `{ page, perPage, search?, tierId? (uuid \| 'none'), status: active\|excluded\|all, sort: joined\|lifetime_points\|total_spent\|name, dir }` | `{ rows: LoyaltyMemberListRow[], total, page, perPage }` |
| `members.export` | customers read | none | `{ csv }` (email,name,status,tier,points,lifetime_points,total_spent) |
| `members.import` | customers write | `{ csv, mode: 'set' \| 'add' }` | `{ updated, unchanged, skipped: {email, reason}[], errors: {line, message}[] }` |
| `members.resetAll` | customers write | `{ confirm: 'RESET' }` | `{ members, points }` |
| `referrals.list` | customers read | `{ status?, page, perPage }` | `{ rows: (ReferralRow & referrer/friend name and email)[], total }` |
| `activity` | customers read | `{ before: Date \| null, limit }` | `LoyaltyActivityItem[]` (`kind: 'points'` or `'tier'`), newest first; page with the last `at` |
| `analytics` | analytics read | `{ from, to }` | `LoyaltyAnalytics` |
| `emails` | settings read | none | `{ template, waiting, sent }[]` |
| `customer` | customers read | `{ customerId }` | `{ tier: TierProgress, redemptions, referral: { code, path, completed, referrals[] } }` |

`LoyaltyMemberListRow = { customerId, name, email, status, tierId, tierName, points,
lifetimePoints, totalSpentPaise, joinedAt }`.

`LoyaltyAnalytics = { from, to, memberRevenuePaise, memberOrders, ordersWithRewards,
pointsIssued, pointsRedeemed, pointsExpired, redemptionRate (0..1 = redeemed ÷ issued),
activeMembers, newMembers, redemptions }`. Orders count like the store's sales: no drafts,
cancels or tests; "member" means joined by the order's time.

`TierProgress = { basis, window, value, current: TierRow | null, next: TierRow | null, toNext }`.

Referral reject reasons: `self`, `same_email` (Gmail dots and `+tags` ignored), `same_phone`,
`same_address` (first line + PIN), `same_device` (when the storefront sends a device id; the
order has no device id on dev yet), `existing_customer`, `limit`, `not_eligible`, and
`order_not_kept` (friend's order refunded, cancelled or returned before the hold ended).

## Storefront (core functions, server side)

All take `ctx = { storeId, tx }` (a `withStore` transaction) and the settings from
`loyaltyState(tx, storeId)`. None return staff-only fields.

| Function | When | Returns |
| --- | --- | --- |
| `publicLoyaltyProgram(ctx, settings)` | signed-out widget | `{ live, pointsName {singular, plural}, pointsAsStoreCredit, waysToEarn: WayToEarn[], rewards: PublicReward[], tiers: PublicTier[], referral: { friendReward } \| null }` |
| `shopperLoyalty(ctx, customerId, settings)` | signed-in widget and account page | `{ open: false, program }` outside the program, else `{ open: true, program, summary: PointsSummary, tier: TierProgress, streakDays, rewards: (PublicReward & { block })[], redemptions: { id, title, rewardType, points, code, status, expiresAt, createdAt }[], waysToEarn: (WayToEarn & { claimed })[], referral: { code, path, completed, friendReward, referrerReward } \| null }` |
| `redeemReward(ctx, { customerId, rewardId, points? }, settings)` | Redeem button | `RedemptionRow` (show `code`, `expiresAt`); throws `LoyaltyError` |
| `recordVisit(ctx, customerId, settings)` | once per signed-in page load (cheap after the first of the day) | `{ counted, streakDays, points }` |
| `claimActionRule(ctx, customerId, ruleId, settings)` | social or Google review button, then open `url` | `{ url, points }` (0 when already claimed) |
| `grantSignupPoints(ctx, customerId, settings)` | right after a storefront sign-in | entry or null |
| `attachReferral(ctx, { friendId, code, deviceId? }, settings)` | after sign-up or checkout while a `ref` cookie is set (`?ref=CODE` from `referral.path`) | `ReferralRow \| null` (null: referrals off or unknown code) |
| `shopperPoints(ctx, customerId)` (v1) | Points page history | summary, birthday, entries |
| `setCustomerBirthday(ctx, customerId, 'MM-DD', 'shopper')` (v1) | birthday form | `BirthdayResult` |

`WayToEarn = { id, type, key, title, points, url, streakDays, onceOnly }`. History lines now
include the v2 sources; storefront copy for each is in `apps/storefront/src/data/loyalty.ts`
(`sources`), admin copy in `apps/admin/src/data/loyalty.ts` (+ Hindi).

## Emails

Core queues; the worker sends. Template ids (`LOYALTY_TEMPLATES` in `notify.ts`) and data
(`LoyaltyNotificationData`):

| Template id | Queued when | Data | Dedupe key |
| --- | --- | --- | --- |
| `loyalty_points_earned` | an earn is credited (not daily visits or streaks) | `{ points, balancePoints, reason }` | `earned:<entry>` |
| `loyalty_reward_redeemed` | any redemption (also tier and referral codes) | `{ title, points, code, lastDay }` | `redeemed:<redemption>` |
| `loyalty_reward_expiring` | unused code 30, then 3 days before it ends | `{ title, code, lastDay, days }` | `reward_expiring:<days>:<redemption>` |
| `loyalty_birthday` | birthday points credited | `{ points }` | `earned:<entry>` |
| `loyalty_tier_unlocked` | first time on a tier | `{ tierName, perks, rewardTitle }` | `tier:<tier>` |
| `points_expiring` (exists) | soonest points 30, then 7 days before they run out | `{ expiringPoints, lastDay, balancePoints, days }` | `points_expiring:<days>:<lastDay>` |

**Needed in `packages/notifications` (not staged on this branch):** templates for the five new
ids above (content, compose, sample data, footer line, primary action, `TemplateId` union).
Until then only `points_expiring` is sent (`apps/worker/src/loyalty.ts`); the others wait in
`loyalty_notification`. When the templates land, extend the worker's `templates` list, and
skip rows older than a few days so a backlog does not go out late. The v1 single reminder
(`reminderDays`, default 14) is replaced by the 30 and 7 day emails; `reminderDays: 0` still
turns them off.

## Worker and hooks

- Hourly `createLoyaltySweep` per store: review and birthday grants, credit due entries, then
  `runLoyaltySweepSteps` (v1 → v2 rules, anniversaries, referrals past their hold, expired points
  recorded, expired codes, expiry emails queued, tiers once a store day), then send queued
  `points_expiring`.
- App hooks (`packages/core/src/loyalty/app.ts`): `order.paid` and `order.delivered` mark reward
  codes the order used; `order.delivered` also plans order points, the first order bonus and the
  referral's friend step; `refund.created`, `order.cancelled`, `order.rto` take order points and
  order-tied bonuses back; `customer.created` gives sign-up and newsletter points,
  `customer.updated` newsletter points.
