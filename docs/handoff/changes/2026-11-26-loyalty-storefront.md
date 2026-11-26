# Loyalty storefront rebuilt to match Essential Loyalty

Branch `feat/loyalty-storefront`, stacked on `feat/affiliate-portal` (47ed52084). No migration:
the new `pages` switches live in the Loyalty settings JSON with defaults.

Reference: the Essential Loyalty storefront captures (`essential-loyalty-storefront.md` and
`shots/loyalty/01`–`29` in the session scratchpad).

## What changed

1. **Floating widget** (`packages/blocks/src/components/loyalty/`)
   - Popup is a floating card, 22.5rem × up to 40rem, 1.875rem from the corner, radius
     1.25rem, Essential's shadow; full screen at 30rem and narrower. The launcher is the same
     distance from the corner, radius 0.75rem, and hides under the open popup. The side panel
     ("Opens as: Side panel") stays.
   - Header on the **store's brand colour** by default: the checkout accent the merchant picked,
     else the live theme's button colour (`storeBrandFor`, `apps/storefront/src/lib/loyalty-view.ts`,
     handed to the embeds as `brandColor`). The old stock `#1f2937` counts as not picked. The
     colour fades to white behind the first card (Essential's look); icons, links and bars are
     the brand colour; buttons are near-black.
   - Visitor home: "Welcome to / {Store} Rewards", Become a member (Join now, Sign in), Points
     (Ways to earn, Ways to redeem), Refer a friend. Ways to earn / Ways to redeem / My
     discounts open as screens with back arrow; visitors get Join now + Sign in pinned at the
     bottom instead of an empty grey area.
   - Member home: balance pill in the header, Next reward (rewards ready + Claim, or the bar to
     the cheapest one), Points (with My discounts and a count), referral card, tier.
   - Ways to redeem rows: title, cost, a progress bar of the balance toward the reward, Claim
     for members.
   - Refer a friend: You get / Your friend gets rows, "Your link" field with a copy button
     inside, one row of share icon buttons.
   - New line icons (hand and coin, gift, cake, cart, mail, ticket, award, percent, share logos).
   - Focus moves into the panel when it opens (`role="dialog"`, labelled by its title); Escape
     and an outside press close it and focus returns to the launcher.
2. **Product page line** above the buy buttons, with no theme edit (`loyalty-placements.tsx`,
   `loyalty-anchors.ts`): "Earn N points with this purchase", "Collect points with our rewards
   program" (visitor) or "You have X points. Earn N points more with this order." (member).
   N = shown price × quantity box × the order spend rule × the member's tier multiplier (as
   core credits). "Show what the points are worth in ₹" adds "(worth ₹N)".
3. **Product card points**: unchanged behaviour (the embed's card option and the card block).
4. **Cart box** above every Checkout button (cart page and the theme cart drawer):
   visitor "+N points for this order" / "Log in to redeem rewards"; member "X points to redeem"
   / "+N points for this order" with a chevron that lists the rewards (the ones that fit first,
   the rest greyed with why). Picking one shows **Redeem and apply**: the existing redeem and
   apply calls (`redeemAndApply` in `loyalty-client.ts`), then the page reloads on the same
   page so the totals show the code. No new pricing logic.
   The "Points on product" and "Redeem in cart" app blocks now draw the same line and box for a
   custom position; when one is on the page the widget does not inject a second.
5. **Referral pop-up**: Essential's centred card: "Friend invitation", "Get 10% off your first
   order", a line, Your name / Your email, Claim reward. A visitor goes to sign in with the email
   already filled (kept in `sessionStorage`, read once by `login-form.tsx`); a member gets the
   code at once.
6. **Loyalty landing page** at `/pages/rewards` (`apps/storefront/src/app/-s/[storeId]/pages/rewards/page.tsx`,
   `LoyaltyLanding`): header with Join now (or the member's balance), how it works, ways to
   earn and redeem, referral, FAQ (with the store's expiry months).
   **Account**: the Points section (`/account/points`) takes the brand colour; a new "Your
   points" card at the top of the account's Orders page (`loyalty-status-summary.tsx`).
7. **Admin → Loyalty → Placements**: product line and cart box show the widget embed's status
   and open it; new **Embedded content** (Loyalty landing page) and **Customer accounts**
   (Account page, Loyalty status) cards with an on/off switch (saves `settings.pages`) and View
   page. Hindi overlay added.
8. **Embed settings** (theme editor): header colour is optional ("Not set: your store's brand
   colour"); three short switches: points line above Add to cart, points box above Checkout,
   show the ₹ value.

## Checks

- Typecheck: blocks, core, storefront, admin.
- Tests: `packages/blocks/test/loyalty-storefront.test.tsx` (points line maths, earn rate from
  the view, next reward, cart rows, cart box guest/member, redeem-and-apply sequencing,
  brand colour), `loyalty-anchors.test.ts` (jsdom: anchors, price × quantity, schema price,
  drawer/cart page, signature), `loyalty-widget.test.ts` updated; core `settings.test.ts`,
  storefront account tests, admin `loyalty-program.test.ts`.
- Checked on localhost:3100 with fake data (a test member with points and a claimed code,
  referrals on), restored afterwards.

## Not done / follow-ups

- The cart box's "+N points for this order" counts the subtotal before a discount code.
- After Redeem and apply in the **cart drawer** the page reloads, so the drawer closes (the
  cart page stays on the cart). Re-rendering a theme's drawer in place is theme specific.
- The referral pop-up's name is only used to greet; accounts are made by sign-in.
- Phone layout checked in a 390px frame, not on a device.
