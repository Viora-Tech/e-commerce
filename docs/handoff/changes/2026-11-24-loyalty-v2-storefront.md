# Loyalty points v2: storefront widget, app blocks, Points page, referral landing

Branch `feat/loyalty-v2-storefront` (from `feat/loyalty-v2` @ `702d5ab53`). Storefront side of
the v2 foundation (`docs/loyalty-v2-interfaces.md`). No migration.

## How the merchant switches it on

Install Loyalty points, then Online store → Themes → Customize → App embeds:

- **Loyalty widget** (`loyalty/Widget`): program name (empty = "{Store} Rewards"), opens as
  pop-up or side panel, left or right, header colour, optional gradient colour, header text
  colour, button text and icon (gift, star, crown, heart, none), "Earn N points" under product
  card prices (our themes), and a CSS selector for an imported theme's prices.
- **Referral pop-up** (`loyalty/ReferralPopup`): heading and header colours.

App blocks (Add → Apps, our React themes): **Points on product** (`loyalty/ProductPoints`),
**Points on product card** (`loyalty/ProductCardPoints`, put on a collection, search or home
page), **Redeem in cart** (`loyalty/CartRedeem`, cart template). Type ids match the admin
Placements page.

Share buttons come from the program's `referrals.shareChannels` (admin Referrals page, on
`feat/loyalty-v2-admin-program`), read defensively: missing → WhatsApp, Email, X, Facebook.

## What a shopper sees

- A floating button on every page (React and imported Liquid themes: embeds are drawn by the
  store layout either way; plain-HTML mode already steps aside when an embed is on). The panel's
  code is a separate chunk loaded on first open (or hover/focus); first paint ships only the
  button. Widget styles use its own `--kl-*` palette and utility classes, never the theme's
  variables.
- Guest: "{Store} Rewards", Become a member (Join now / Sign in, both to sign-in, which makes the
  account), ways to earn, ways to redeem, referral teaser.
- Member: points (+ worth ₹X when points are store credit), expiring and pending points, tier
  card with perks and progress, rewards with Claim (code with Copy and "Apply at checkout": puts
  the code on the cart, then opens checkout), My discounts, ways to earn (social and Google
  review rules open the link and credit points via `claimActionRule`), referral link with share
  buttons and both rewards. The daily visit (and sign-up points, a waiting referral) is sent
  once a day per browser after page load.
- Points page (`/account/points`): existing balance and paged history, then the same tier,
  rewards, discounts, ways-to-earn and referral cards; opening it counts the visit.
- Referral: `?ref=CODE` landings keep the code in `wc_lref` (host-only, httpOnly, 30 days),
  set in the proxy's existing `?ref=` hook only after a yes to marketing cookies (same rule as
  affiliate links). The Referral pop-up's "Get my reward" keeps it regardless (the shopper's own
  request): signed in → `attachReferral` and the welcome code at once; signed out → sign in, back
  to the same link, then the code. The cookie is attached at the next visit ping and after
  checkout (`lib/order-placed-extras.ts`), then cleared.

## Code

- `packages/blocks/src/components/loyalty/*` (+ `src/data/loyalty-widget.ts`), subpath
  `@commerce/blocks/loyalty`. Pure: `loyalty-math.ts` (earn preview, rewards that fit a cart,
  tier %, theme price text, `?ref=`), `loyalty-share.ts`, `loyalty-settings.ts`.
- `packages/core/src/loyalty/storefront-blocks.tsx` (`@commerce/core/loyalty-blocks`): embed and
  block definitions; attached in `app.ts` (`storefront`) and `commerce.blocks.config.ts`.
- Storefront: `app/api/loyalty/[action]/route.ts` (GET `state`, `earn`; POST `visit`,
  `redeem`, `claim`, `apply`, `referral`; same-site POSTs, 30/min per IP), `lib/loyalty-view.ts`,
  `lib/loyalty-shopper.ts`, `lib/loyalty-referral.ts`, `lib/order-placed-extras.ts`,
  `components/account/points-loyalty.tsx`.
- Shared files touched: `lib/app-embed-data.ts` (embed data: store name + session cookie
  present), `lib/referral-landing.ts` (loyalty cookie beside the affiliate one),
  `lib/cart-actions.ts` (post-order work moved to a helper), product page `appBlockContext.loyalty`,
  `product-card.tsx` (`data-loyalty-price`), the account Points page, sweeps allow-lists
  (no-orphans: foundation entries dropped, the lazily loaded panel added; service-layer: two
  storefront libs).

## Tests

`packages/blocks/test/loyalty-widget.test.ts` (earn math, cart fit, tier %, price text, `?ref=`,
share URLs and channels, embed settings), `apps/storefront/src/lib/loyalty-referral.test.ts`.
Blocks suite passes; typecheck clean for blocks, core and storefront apart from the existing
missing `@commerce/payments-snapmint` / `write-excel-file`. Admin not typechecked here.

## Gaps / for the owner

- "Points on product card" and the imported-theme selector add the line by DOM after load;
  Liquid themes need the merchant's selector (none set by default). App blocks do not render
  inside Liquid sections (existing limit), so on Zero Drift use the embed options.
- Earn preview uses the order spend rule and tier multiplier; running campaigns are not shown.
- Custom amount rewards are claimed at their smallest step (no amount picker yet).
- The friend pop-up asks a guest to sign in rather than creating a customer from a typed email
  (so codes are not handed to unverified addresses). Owner to confirm.
- The guest program is cached one minute (loyalty tables have no storefront-cache trigger).
- Messenger share opens the app link (`fb-messenger://`); the web dialog needs a Facebook app id.
