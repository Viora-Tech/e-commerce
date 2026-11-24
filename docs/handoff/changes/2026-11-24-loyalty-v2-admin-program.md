# Loyalty points v2: admin Program, Reward and Placements screens

Branch `feat/loyalty-v2-admin-program` (from `feat/loyalty-v2` @ `702d5ab53`). Built on the
foundation in `docs/loyalty-v2-interfaces.md`. Members, analytics, campaigns and activity are on
another branch (admin insights); storefront widgets on a third.

## Screens

- **Program** (`/apps/loyalty`, new app root, `components/apps/loyalty/program/`): status chip
  with Go live / Pause (pause asks first; saves only `programStatus`), a Loyalty | Referrals
  switch.
  - Loyalty: VIP tiers as tabs (+ Tier) with the picked tier's fields (name, threshold in points
    or ₹ per the tier basis, multiplier, customer tag, reward on reaching it, card colours) and a
    live member card preview; Points per spend (the `order_spend` rule: rate, on/off, product
    tags that earn nothing, plus the shipping and taxes switches); Ways to earn (rows open the rule
    editor; + Rule opens "Add a way to earn", grouped Store activity / Reviews / Social with icons;
    taken rules are marked); Rewards to redeem (rows open the reward page); Perks for the picked
    tier; Loyalty settings (points name, expiry months, expiry emails switch, tier basis and
    window, points as store credit, excluded customer tags, test accounts).
  - Settings, the spend rule and tiers save together from the one Save bar; rules save from
    their dialog, rewards from their page, tier removal at once (confirm).
  - Referrals: on/off, referring member and friend rewards (points, % off, ₹ off), code days,
    most friends per member, wait for the return window, three tags, share buttons, and a
    read-only "Fraud checks always on" card.
- **Reward** (`/apps/loyalty/rewards/new` and `/rewards/<id>`, `components/apps/loyalty/reward/`):
  type tiles, value or product picker, title with `{amount}` and a preview line, description,
  who can redeem (all or a minimum tier) and the points cost (or per step with fewest/most),
  minimum order, usage limits, once per member, code days, active, Remove; summary panel on the
  right. The `{amount}` placeholder is filled on save (the storefront shows the title as saved)
  and put back when the reward is opened again (`lib/loyalty-reward-form.ts`).
- **Placements** (`/apps/loyalty/placements`): Floating widget, Product page points, Product
  card points, Cart redeem, Referral pop-up. Each says where to switch it on and opens Customize
  on the live theme (`?panel=apps` for embeds, `?panel=sections` for blocks). Embeds show
  Ready/Off from the live theme's `appEmbeds`; blocks show "App block" (no status).
- **Customer page** Loyalty card: tier chip in the tier's colours and what reaches the next,
  lifetime points, referral code and friends referred, rewards redeemed with status and
  "Cancel code (refund points)" for unused codes (not store credit).
- The old v1 Overview moved to `/apps/loyalty/overview`; the v1 Settings page is gone (its
  numbers are now the spend rule, rules and the settings block).

## Shared files touched (small edits)

- `apps/admin/src/apps/registry.ts`, `packages/core/src/loyalty/app.ts` (pages: Program,
  Overview, Placements, `rewards/[id]`; Settings removed).
- `apps/admin/src/data/hi/index.ts` (five new Hindi files).
- `apps/admin/src/components/themes/customize/customize-layout.tsx`: reads `?panel=apps|sections|theme`
  once to open that rail panel.
- `packages/core/src/loyalty/settings.ts`: `referrals.holdForReturns` (default true) and
  `referrals.shareChannels` (`REFERRAL_SHARE_CHANNELS`, default WhatsApp, Email, X, Facebook).
  `referrals.ts` uses `holdForReturns` (off: no hold after delivery).
- `packages/api/src/routers/loyalty-v2-members.ts`: `loyalty.customer` adds `lifetimePoints`
  (points earned, lifetime, via `tierValue`).

## For the storefront branch

- Theme types the Placements page expects (`lib/loyalty-placements.ts`): embeds
  `loyalty/Widget`, `loyalty/ReferralPopup`; blocks `loyalty/ProductPoints`,
  `loyalty/ProductCardPoints`, `loyalty/CartRedeem`. Rename there if the storefront picks others.
- Share buttons: read `settings.referrals.shareChannels`.

## Tests

- `apps/admin/src/lib/loyalty-program.test.ts`, `loyalty-reward-form.test.ts` (18 pass): draft and
  dirty tiers, multiplier and threshold conversions, emails, placement status, reward title
  placeholder, reward and rule inputs parse with the core schemas.
- Admin typecheck: only the known missing modules and `customize-overrides.tsx` (not touched).
  `lint:components` clean for these files; biome clean.

## Not done / to check on localhost

- Hindi titles: a reward made while the admin is in Hindi starts with a Hindi title.
- "Shipping & taxes included" is on the Points per spend card only (not repeated in settings).
- Program page not tried in a browser here (no dev server on this branch).
