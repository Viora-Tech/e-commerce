# Affiliates admin laid out like UpPromote (25 Nov 2026)

Branch `feat/affiliates-uppromote`. The owner approved the same layout, card order, fields and
short labels as UpPromote Affiliate (Shopify). Long help text is in our own words, the visuals use
our admin design system, and there is no upsell or plan lock. No API, schema or migration change.
Routes are unchanged; only menu labels, titles and order moved.

## Menu (`packages/plugin-affiliates/src/plugin.ts`)

Home (`''`), Programs, Affiliates, Referrals (`commissions`), Payments (`payouts`), Motivation
(`creatives`), Settings. `packages/core/src/apps/catalogue.generated.ts` `adminPages` was updated
by hand to match (the generator could not run in this worktree: `@commerce/payments-snapmint` is
missing from its node_modules). Re-run `bun scripts/gen-app-catalogue.ts` once it can; the output
should be the same.

## Screens

- **Home** (`overview-page.tsx`, centred 50rem): "Home" title and one line; the stat strip Sales |
  Referrals | Clicks | Affiliates; the "Default affiliate program" card
  (`default-program-card.tsx`): "Affiliates earn n% commission on each referral sale.", the
  Registration link row with copy and share (Web Share, else opens the link), "Edit signup page",
  and a grey Tips box saying affiliates sign in at the same link. Then our own alerts, trend card
  and top affiliates.
- **Programs** (`programs-page.tsx`): segmented Affiliate program | Referral program. Referral
  program is our Share and earn (`referral-program-card.tsx`: On/Off chip, the program buyers
  join, Set up → Settings). Program list: Name with a Default chip under it, Type (Percent of
  sale / Fixed amount), Amount (10% or ₹150, plus "+ n order-value levels"), Affiliates, Signup
  link, Status (Archived). Primary button "Add affiliate program".
- **Edit program** (`program-editor.tsx`, centred 64rem, main 2/3 + sticky side 1/3):
  1. General information: Name, Description (optional) = the signup page pitch.
  2. Commission rules (`program-commission-rules.tsx`): Default commission with Rule (Simple /
     Tiered by order value, which shows the levels), Type and Amount with a % or ₹ affix; Special
     product commission (Active/Inactive chip + Set up, our per-product/collection rates);
     Advanced commission: Lifetime commissions switch (+ days); Affiliate tiers (Set up).
  3. Customer incentives (`program-incentives.tsx`): Auto-discount for customers = the
     affiliate's personal code and what buyers save.
  4. Commission calculation (`program-calculation.tsx`): Excluded products/collections (Set up);
     Shipping, taxes and other fees with Exclude product tax, Exclude shipping, Exclude gift cards
     marked "Always"; Self-referrals: Exclude self-referrals, "Always".
  5. Other settings: Signup page (`program-signup-card.tsx`: link or slug, approval, terms),
     Signup questions, Check a rate.
  - Side: Summary (`program-summary-card.tsx`): name, Active/Archived and Default chips, and
    Commission structure bullets built from the form.
  - `setup-card.tsx` is the shared "title + chip + Set up" card. `commission-settings.tsx` was
    split into `program-overrides.tsx` and `program-tiers.tsx`; `program-levels-card.tsx` and
    `program-excludes-card.tsx` are now `program-levels.tsx` / `program-excludes.tsx` (no card).
- **Affiliates**: with none yet (and no search or filter), a page empty state with the people
  icon, "Manage affiliate list", one line and Add affiliate.
- **Referrals** (`commissions-list.tsx`): title "Referrals", sub line "Referrals recorded this
  month: n." (counted from the loaded ledger, only while nothing narrows it); empty state with the
  inbox icon, "Manage affiliate referrals".
- **Payments** (`payouts-page.tsx`): title "Payments"; Approved referrals | Paid referrals.
  Approved: `payment-candidates-table.tsx` (checkbox, Affiliate, Payment info, Referrals,
  Total amount; Commission shown, Clawback/GST/TDS hidden by default) with a bulk "Create
  payouts" for ticked rows (the API's `affiliateIds`), then "Payments to mark paid"
  (`payouts-table.tsx`, Cancel / Mark paid). Paid: the paid payouts with Reference and date.
  Header: TDS report (26Q), Export payments (the bank file), Create payouts. Empty: "No data".
- **Motivation** (`creatives-page.tsx`, centred 50rem): Promotional resources with two cards
  (`motivation-resources.tsx`): Coupons → Discounts, Media gallery → Add media (the creatives
  picker); the creatives grid under "Media gallery".
- Copy: new `data/affiliates-layout.ts` + `data/hi/affiliates-layout.ts` (registered in
  `data/hi/index.ts`); `affiliates.ts` and `affiliate-creatives.ts` titles renamed (Referrals,
  Payments, Motivation) with Hindi.

## UpPromote parts left out, and why

- Home: the date-range select. `affiliates.overview` returns all-time totals only.
- Home and Referrals: the "Enable app embed" card / banner. The app has no app embed (only the
  Affiliate signup app block); referral tracking runs server-side.
- Home: Custom domain button. Affiliates use the store's own domain.
- Programs: Auto tier commission button (spec: skip), Custom columns menu label (our table's
  column menu is there), Export file, the per-row on/off switch (programs have no on/off; only
  archive, on the program page), and the Referrals column (the list read has no per-program
  referral count).
- Edit program: the Status switch (no program status; Archive / Open again stay as the header
  button), New customer commission and Special coupon commission (not stored; the lifetime
  switch covers first order vs every order), Excluded "Apply to" select (we keep a plain list),
  shipping tax and tip rows (no such fees stored; GST, shipping and gift cards are always out),
  and Payment methods per program (affiliates choose UPI or bank themselves; not per program).
- Affiliates: Import affiliates, Connect products, Connect customers (no import API).
- Referrals: Import referrals and Add referral (no manual add API).
- Payments: filter chips Date / Payment method / Affiliates / Program (payout reads take no
  filters; search covers name, code and payment info), and a separate Payment method column
  (only the masked payment hint is returned).
- Motivation: Incentives (Gifts, Bonuses). Not supported. Creators (influencer search): not ours.

## Checks

Admin typecheck has no new errors (three existing ones from stale worktree modules:
`customize-overrides.tsx`, `@commerce/payments-snapmint`, `write-excel-file/node`). Biome clean on
touched files; `lint:components` reports nothing new for affiliates. `lib/i18n.test.ts` and
`core/src/apps/catalogue.test.ts` pass. Not looked at in a browser.
