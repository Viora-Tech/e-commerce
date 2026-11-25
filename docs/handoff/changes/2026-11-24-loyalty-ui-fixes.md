# Loyalty points: owner's UI fixes (24 Nov 2026)

Branch `feat/loyalty-points`. Fixes from the owner's screenshots of the admin customer page.

## What changed

- **Adjust points dialog**: Add / Remove is the shared `ToggleGroup` `segmented` switch (as the
  address dialog's role switch and the gift card balance dialog), two equal halves filling the
  dialog, the picked half lit. It was `PillTabs` segmented without `fill`, so the options sat
  small on the left of a full-width track.
- **History labels**: a staff change reads **Added** or **Removed** (Hindi जोड़े गए / हटाए गए),
  never "Adjusted · Credited"; any line that takes points away (a reversal) drops "Credited".
  Pure helper `apps/admin/src/lib/loyalty-entry.ts` (`pointsEntryKind`). The storefront Points
  page reads a staff removal as "Removed by the store" (`describePoints`).
- **Paging, server-side**: `loyalty.forCustomer` and `storeCredit.get` take an optional `limit`
  (1 to 200, default 50 as before). The customer page's Loyalty points and Store credit cards
  show the newest 5 and ask for one more line to know if older ones exist; **Show older** adds 10
  (another read), **Show fewer** goes back to 5 (`lib/history-page.ts`,
  `components/layout/history-pager.tsx`). The storefront `/account/points` and
  `/account/store-credit` show 10 and link **Show older** to `?show=N` (`lib/account-history.ts`,
  `components/account/history-more.tsx`); `shopperPoints` takes a `limit`.
- **Points on Liquid themes**: nothing to change. `/account/*` are our React pages on every
  theme, drawn inside an imported theme's header and footer (the import never brings
  `customers/*` templates, so the `account` template is our default `MainAccount`). The account
  nav lists Points after Store credit when the app is installed (new test `account-nav.test.ts`).
  On Waimers (Zero Drift) the theme links `/account` from the header's more menu ("Sign in"),
  the phone's bottom dock ("Account"), the menu drawer and the footer ("Your account").

## Tests

- `apps/admin`: `src/lib/loyalty-entry.test.ts`, `src/lib/history-page.test.ts`.
- `apps/storefront`: `src/lib/account-history.test.ts`,
  `src/components/account/points-history.test.ts`, `src/components/account/account-nav.test.ts`.
