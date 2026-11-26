# Affiliate portal polish (26 Nov)

Owner asked to improve the affiliate portal UI after #1805 went live. Branch
`feat/affiliate-portal-polish` from dev 351a631d5. No migration, storefront + ui only.

## What changed

- **Brand colour**: the portal uses the store's checkout brand colour (Settings › Checkout ›
  Branding accent) through the admin's accent tokens (`accentCss` from
  `@commerce/core/admin-accent`, a `<style>` in `app/-f/[storeId]/layout.tsx`): buttons, focus
  rings, the active menu item and the chart's first series. No colour set keeps shadcn's neutral.
- **Store tile**: `StoreMark` shows the live theme's favicon (`theme.brand.favicon`), not the wide
  logo (Waimers' 770×200 wordmark shrank to a black speck in the 2rem tile). No favicon: the
  first letter on the brand colour. `PortalStore` gains `iconUrl` and `brand`.
- **Chart**: legend under the chart (`legend` prop on `@commerce/ui/global/area-chart`) and a
  "No clicks yet" message over an empty range.
- **Empty states**: shadcn's Empty block (`portal-empty.tsx`) on Commissions (with "Get your
  link"), the dashboard's latest commissions, Payouts and Marketing tools. Pagination hides on an
  empty table.
- **Payouts**: the payout method is a card with Add payout details / Change; the Reference
  column has room from Paid to you.
- **Settings**: shadcn's forms-example layout: a line of help, a separator, the sections down the
  left on a wide screen (a scrolling row on a phone) and the form beside them. The tab row's
  stray scrollbar is gone.

## Checked

- Localhost :3100 (`waimers.localhost`), signed in as a local test affiliate, light and dark:
  dashboard, commissions, payouts, marketing, settings, sign-in.
- Storefront typecheck clean; portal tests (3 files, 24) pass.

## Left to check

- Phone width (390px) in a real browser.
- A store without a favicon (letter tile) and without a brand colour (neutral).

## Second pass: matched to shadcn's blocks (owner: scroll bar, alignment, gaps, widths)

Compared page by page against dashboard-01, login-03 / login-02 and the forms example
(v3.shadcn.com/examples/forms; the v4 site no longer has it), light and dark, and at phone
width (390px frames).

- **Scrollbars**: the portal's `<html>` keeps a stable gutter (`[scrollbar-gutter:stable]`), so a
  short page and a long page have the same width; scrollbars stay thin (`portal.css`).
- **Number cards** (`section-cards.tsx`): dashboard-01's footer, tight under the value
  (`pt-0`): the trend line with its arrow, then what the number counts. "Last 30 days" is
  named once, on the chart, not on all four cards.
- **Payout nudge**: the full-width alert at the top of the dashboard is gone
  (`payout-banner.tsx` removed). The Balance card's footer says "Add your payout details" with
  the button; once saved it shows the next-payout lines instead.
- **Link and Balance cards**: footers pinned to the bottom at one height, so the pair lines up.
  Link card: the link and the discount code with Copy, QR code in the header corner, the footer
  holds Get product link, Get link with source and one Share menu (WhatsApp, Facebook, X,
  Telegram, the phone's share sheet) instead of a row of five buttons.
- **Latest commissions** (`recent-commissions.tsx`): a card with See all in the corner, the newest
  five in a plain table (no status tabs or pagination), shadcn's Empty inside when there are none.
  The table itself is shared with the Commissions page (`commissions-grid.tsx`).
- **Commissions**: the native date inputs are a shadcn date range picker
  (`date-range-filter.tsx`: Popover + Calendar `mode="range"`, two months, Reset / Apply, like the
  admin's). The status tabs become a select on a narrow page (dashboard-01 does the same), so the
  page never scrolls sideways on a phone. The privacy line moved under the table.
- **Payouts**: the payout method is a shadcn Item (icon, masked method, Add / Change; the button
  drops under the text on a phone); the table and its empty state sit in a "Payouts" card with
  Export CSV in its corner. No floating description line.
- **Settings**: the forms example's layout exactly: sections nav a fifth of the width, content
  `max-w-2xl`, each page a heading + muted line + separator and the form on the page, no cards
  (`settings-section.tsx`). The extra Payouts card under the payout form is gone (the saved
  method shows in the section's line). Profile has two sections: Profile and Referral code.
- **Guide**: tips sit beside the steps inside the Getting started card (a vertical separator on a
  wide page, under them on a phone), so no short card leaves a hole; Program terms below.
- `packages/ui` `Calendar`: `CalendarDayButton`'s `locale` prop allows `undefined`, so the
  storefront (`exactOptionalPropertyTypes`) can use the Calendar.

Checked: storefront and ui typecheck clean; portal tests (3 files, 24) pass; component-structure
check has nothing for the portal. Sign-in and signup already matched login-03 / login-02 and were
left as they are.

Not changed: Marketing tools still has its one-line description above the grid (only an empty
state to compare locally).

