# Loyalty Program, rule and reward screens in Essential Loyalty's layout (25 Nov 2026)

Branch `feat/loyalty-v2`. The owner approved Essential Loyalty's layout, card order, fields and
short labels for the Loyalty app's Program screens. Help text is in our own words and the visuals
use our admin design system. No API, schema or migration changes.

## What changed

- **Setup bar** (`components/apps/loyalty/setup-bar.tsx`, new and shared): the steps run in a row
  ("1% rate", "Activate program", "Enable placements", "Loyalty live"). Done steps are ticked. The
  current step shows its title, a Ready chip, one line of help and the page's button. The bar hides
  once every step is done.
  - Props: `{ live: boolean; placementsOn: boolean; ratePercent: number; action?: ReactNode }`.
  - Also exports `setupStepOf(state)`, which returns `'rate' | 'activate' | 'placements' | 'live'`,
    and `percentText(n)`.
  - `placementsOn` means the live theme's `loyalty/Widget` app embed is on.
  - `ratePercent` is points per ₹100 on the order spend rule, or 0 when that rule is off.
- **Program page** (`program/program-page.tsx`):
  - Header: "Loyalty program" title, a status chip, a ⋯ menu (Members, Placements, Emails, Turn
    referrals off) and Enable/Pause.
  - Under it: the Loyalty | Referrals switch, then "Rewards rate n% | Low/Typical/High"
    (`rewards-rate.tsx`), then the setup bar.
  - The page also loads the theme list and `store.current` to get the embed state, the Customize
    link and the store name.
- **Loyalty tab:**
  - Tier strip (`tier-strip.tsx`): each tab shows the tier's colour, name and "Starting tier" or
    "From …". "+ Tier" and a compare-tiers button (`tier-compare-dialog.tsx`) sit at the end.
  - Left column, built from `ListSection`/`ListRow` lists whose rows expand in place, in this order:
    1. Points per spend, with a ⇅ toggle between the base rate and the picked tier's rate. The tier
       rate edits that tier's multiplier.
    2. Earning rules.
    3. Rewards to redeem.
    4. Perks, with an "Add your first perk" empty state.
    5. Loyalty settings.
  - Right column, sticky (`tier-panel.tsx`): the gradient tier card with a glyph chip, store name,
    tier name and QR mark. Under it are rows for name, starts at, customer tag, reward on reaching,
    text colour and background, then Remove tier.
- **Earning rule editor:** now a wide right-side sheet (`rule-sheet.tsx`, `rule-fields.tsx`,
  `rule-preview.tsx`) in place of the dialog.
  - Header: breadcrumb, title, Enabled chip, Disable/Enable, Delete, Save and close. Closing with
    unsaved edits asks first.
  - Left: the "Customer title" card, then "Points earned" with a line saying how often it counts.
    Fields: "Customer gets [n] points", plus days, link and button where the rule type uses them.
  - Right: the shopper preview.
- **Reward page** (`reward/*`):
  - Header: breadcrumb back to "Loyalty program", Enabled chip, the type as the sub line,
    Disable/Enable, Delete and Save.
  - Left, in order:
    1. Type picker row (a dropdown with glyphs), customer title with "Customers see: …", and the
       description.
    2. Reward (the value or the product).
    3. Eligibility: tier select and points on one row.
    4. Requirements: radios for no minimum or a minimum purchase amount.
    5. Usage limit: checkboxes, with "Used n times".
    6. Discount code: "Code expires" set to Never or after a number of days.
  - Right: the shopper preview row ("Redeem for n points") and the Summary.
- **Referrals tab:**
  - A "Disabled" chip beside the switch, and an amber "Referrals program disabled" banner with
    Enable.
  - "Referring member" list: the reward row, Tag member, Limit number of referrals, and Hold reward
    for refund window.
  - "Referred friend" list: the reward row, Tag friend, Tag order, and Code expires.
  - Social sharing options in two columns with platform glyphs.
  - Fraud protection card with an "Always on" chip and four check groups, all of them checks we
    really run.
  - Right: a "Referral pop-up" card with Edit (opens Customize › App embeds) and a small preview of
    the pop-up.
- **Copy:** `data/loyalty-program.ts`, `loyalty-reward.ts` and `loyalty-rules.ts` now use the short
  labels ("Earning rules", "Rewards to redeem", "Perks", "Loyalty settings"). The Hindi overlays
  are updated to match.

## Essential fields we do not back (left out)

- Points per spend "+ Rate": extra rates per collection or product. We have one base rate plus tier
  multipliers.
- Tier icon picker, and "Disabled" tiers.
- Loyalty settings "Tag VIP customers" switch. Tagging is per tier (each tier's customer tag field).
- Rule page:
  - "Earning method" (increments vs fixed). Only the order spend rule earns per amount spent, and
    it is the base rate row, not a rule.
  - Icon choices, "Customize icon" and "Custom image Upload".
- Reward page:
  - Purchase type (we have no subscriptions).
  - Discount code "Code prefix".
  - "Combinations" (product, order and shipping discounts).
  - Icon choices, "Customize icon" and "Custom image Upload".
- Referrals: the LINE share channel. We support WhatsApp, Email, X, Facebook, Messenger, Threads
  and Telegram.
- Fraud: "leaked reward codes". We do not run that check, so it is not listed.

## Notes

- The rule editor is a side sheet, not a route, so `apps/registry.ts` is unchanged.
- No new tests. The pure helpers in `lib/` did not change. Typecheck passes, and biome and the
  component checker are clean on the touched files.
