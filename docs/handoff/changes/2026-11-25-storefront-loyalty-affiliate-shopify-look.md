# Shopper-facing Loyalty widget and Affiliate signup page in the Shopify apps' layout (25 Nov 2026)

Built on `release/nov25`. The owner approved matching Essential Loyalty's widget and UpPromote's
register page. We copied the layout, the order, the fields and the short labels. Longer text is
in our own words. Colours come from the merchant's settings or the theme tokens. There is no
"Powered by". No API, schema or migration changes.

## Loyalty widget (`packages/blocks/src/components/loyalty/`)

- **Panel shell** (`loyalty-panel.tsx`, new `loyalty-panel-header.tsx`): the header is solid, in
  the embed's header colour (or gradient). It shows a small "Welcome to" ("Welcome back to" for a
  member) over the large program name. A member's balance sits under the name. The body is a soft
  grey. Its white cards (new `loyalty-card.tsx`) overlap the header's bottom edge
  (`pb-14` on the header, `-mt-10` on the cards).
- **Screens:** the panel has a `screen` state: `home`, `earn` or `redeem`. The list screens have
  a compact header with back ‹, the title and ×. For a guest, Join now and "Already have an
  account? Sign in" are pinned at the bottom (new `loyalty-join.tsx`). Closing the panel or
  pressing Escape goes back to home.
- **Guest home** (`loyalty-guest-body.tsx`): three cards.
  1. Become a member: one line, a dark full-width Join now, and Sign in.
  2. Points (new `loyalty-points-card.tsx`): one line, then the "Ways to earn" and "Ways to
     redeem" rows, each with an icon and ›.
  3. The referral teaser.
- **Member home** (`loyalty-member-body.tsx`): the cards are in this order.
  1. Worth, expiring and pending. Only shown when any of them applies, because the points
     balance is already in the header.
  2. Points.
  3. Tier.
  4. My discounts.
  5. Refer a friend.
- **Rewards to claim** moved into the Ways to redeem screen. That screen has the Claim buttons
  and shows the claimed code. The Go and Done buttons are on the Ways to earn screen.
- **List rows** (`loyalty-earn-list.tsx`, `loyalty-reward-list.tsx`): each row has an icon in a
  soft circle (`wayGlyph` / `rewardGlyph` in `loyalty-format.ts`; new glyphs in
  `loyalty-icon.tsx`), a bold title and a muted line.
  - Earn lines: "+600 points", "+8 points for every ₹100 spent".
  - Reward lines: "for 1,000 points".
  - `LoyaltyEarnList` has a new `heading` prop (default true). An empty `title` hides the
    reward list's heading.
- **Copy** (`data/loyalty-widget.ts`):
  - New keys: `welcome`, `welcomeBack`, `back`, `pointsCard`, `earn.value`.
  - Changed rule names: "Celebrate a birthday", "Subscribe to our newsletter", "Place your
    first order".
  - `rewards.cost` now reads "for N points".
- The Points account page uses the same cards, so it picks up the new card style.
- **Launcher:** unchanged. It was already the gift + "Rewards" pill at the bottom right.

## Affiliate signup page (`apps/storefront/src/app/-s/[storeId]/affiliate/page.tsx`)

- **Before approval:** the page has two columns.
  - Left (35%): new `affiliate-brand-panel.tsx`. A `bg-brand` panel with the store name large
    and "Become our partner" under it. On a phone it becomes a band on top.
  - Right, top: a Login outline pill, shown only when signed out.
  - Right, below it: the heading "Join our affiliate program" (uppercase), then the merchant's
    pitch when one is set.
  - Then the Benefits box (new `affiliate-benefits.tsx`) with these rows: Cookie days,
    Commission type, Commission amount (with "up to" for tiers), Customer discount (only when
    the coupon is on), and Additional terms (the first line of the terms).
  - Then the form slot.
- **Form** (`affiliate-apply-form.tsx`, `signup-fields.tsx`):
  - Labels are small and uppercase, with a red * on required fields.
  - Fields in order: First name and Last name (sent joined as `name`), then the account's Email
    (read-only), then our own fields (profile, channels, audience, the program's questions, UPI,
    terms).
  - The button is a full-width JOIN.
- **Signed out:** the form slot shows one line and a full-width JOIN that goes to the store's
  sign-in (`affiliate-sign-in.tsx`). We kept our own sign-in flow, so there are no password
  fields and no captcha.
- **Removed:** `affiliate-landing.tsx` (the headline, perk chips and 3 steps) and its
  `landing` copy. `program-terms.tsx` stays, because the dashboard uses it.
- **Store name:** read with `storeRead(storeId, 'store-name', …)`.

## Checks

- `tsc` passes in `packages/blocks` and `apps/storefront`.
- `test/loyalty-widget.test.ts` passes (19 tests, including 2 new ones for row wording and
  icons). The storefront referral and loyalty lib tests pass.
- `biome check` is clean, and `lint:components` reports nothing in the touched files.
- Not seen in a browser, because no dev server was running for this change. Check it on
  localhost:
  - the overlap of the cards on the header;
  - the phone band on the affiliate page.
