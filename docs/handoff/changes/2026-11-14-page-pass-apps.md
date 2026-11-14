# Page pass 14: Apps list and app pages

Audit section 7, row 14 (`/apps`, `/apps/[pluginId]/…`). Layout and states only: every booking,
label, invoice, invoice number, GST figure, setting, connect and test action is as before.

## Already in place (checked, left alone)

- Wave 2: every app page is under the shared PageHeader (AppShell); app tables are on
  SimpleTable / `gst-invoices/table-classes`; the search apps' KitTable is gone.
- #1698: the open app's pages are in the main sidebar on desktop; the in-page AppNav is phones only.

## New shared parts (apps only)

- `apps/shared/load-failed-state.tsx`: "Could not load the …" with Try again (InlineState for a
  card, PageState for a page; no-access for FORBIDDEN). Every app failure below uses it.
- `apps/shared/table-failed-row.tsx`: the same failure inside a plain app table, under its header
  (the list table's TableFeedback).
- Copy `appsContent.couldNotLoad.*` (+ Hindi).

## Owner's live apps

- **GST invoices.** Queue: the list sits on the list table's card; a failed read says "Could not
  load the queue"; "none ready / none to fix" is EmptyState. Queue figures are one joined
  StatStrip (were four floating boxes) with grey bars while they load. Invoices: a failed read
  shows "Could not load the invoices" with Try again in the table (was a toast over "Nothing
  issued"). Invoice page: loads with a skeleton and fails with Try again (was blank), cards are
  DataCards. Products tab: skeleton rows while loading, "Could not load the products" on failure
  (rows were empty and silent). Returns: the month table no longer shows every month as "Open"
  with "Mark filed" before the marks are read (skeleton rows; failure with Try again); Mark filed
  / Close spin on the pressed button. Return summary failure has Try again. Settings failure says
  "Could not load the settings". GST card on the order page: skeleton, then the card; a failed
  read shows Try again (was hidden).
- **RapidShyp, Delhivery and the other provider apps** (shared Overview and Connect pages):
  Overview status card draws placeholder lines while loading and fails with Try again (was empty
  forever). Connect: a failed settings read shows "Could not load the connection" (was a skeleton
  forever); the skeleton is the page's own columns; Test connection shows one spinner (was two);
  the passed and failed lines are Alert success / danger. Webhook card and manual-parcels card
  fail with Try again.
- **Delhivery Overview:** the four tiles are one joined strip; failed figures show a dash (were
  bars forever); recent shipments and pickup locations say "Could not load …" with Try again
  (were "No shipments yet" / "no places"); not-connected is EmptyState. Pickup locations page:
  same failure in the table, list-table card. The webhook hint is Alert info.
- **COD / RTO:** Overview loads as two strips and two cards, fails with Try again (was a strip of
  no cells forever); the risk card is a DataCard; "score open orders" is an Alert with its
  button. Risky orders: skeleton rows, failure in the table. Return reasons: strip placeholders,
  two DataCards, failure with Try again. Settings: section skeleton and failure (was blank).
  Order-page card: skeleton and failure (was hidden).
- **Razorpay:** nothing in Apps; its pages redirect to Settings › Payments (settings pass).

## The rest

- Apps list: a failed read shows in the table under the header (was a page of its own); the
  summary line keeps its height while loading; status filters are PillTabs (were own pills).
- App page loading screen matches AppShell's PageHeader (back line, 3rem logo, title, chip, menu).
- Affiliates: Overview, Programs, Affiliates, Commissions, Payouts, Creatives, Settings, program
  and affiliate pages load with skeletons and fail with Try again (most were blank or silent);
  overview banners are Alerts; tables and the note card are DataCards; review flag is Alert
  warning.
- Back in stock: Overview usage cards are DataCards (figure on `text-stat`), skeleton and
  failure; Signups failure in the table, import button spins; Settings skeleton and failure.
- Delivery options: the overview read reports failure (was a toast and a blank page); Overview
  tiles are one StatStrip; the checkout preview is a DataCard; option cards and layout picks are
  `rounded-lg`.
- WhatsApp: Setup, Templates and Messages fail with Try again; the Meta error is Alert danger;
  template skeletons are DataCard skeletons; "More" spins.
- Search: Recommendations, Filters, Synonyms and Boosts load with section skeletons and fail with
  Try again (were blank). Search Console: report failure has Try again; empties are EmptyState
  `page` (were EmptyState inside a raw Card); reconnect is Alert danger.
- Pixels, Forms: failures in the table / page with Try again; Pixels draws strip and card
  placeholders.
- Chatwoot, EMI, GrowthBook, Meilisearch, Umami status lines are NoticeBar (were hand-made
  `surface-banner` boxes); their settings pages fail with Try again.
- Shopify import: run figures are one joined strip; cards and lists `rounded-lg`.
- The guard's raw-size fixes in six apps files (identical to `design/guard-design`).

## Shared files touched

None outside `components/apps/`, `data/apps.ts` and `data/hi/apps.ts`.

## Not done

- ~30 app settings cards stay on SettingsCard (the settings pass owns that family). The connect
  form card and courier guide stay untitled ui Cards.
- Delhivery Pickups / Shipments pages wrap the shipments components (shipments pass).
- Still silent on failure: Reviews (questions, settings), Automations, Shopify import connect and
  settings, S3, Chatwoot conversations card, India Post label page, delivery option page, the
  product-page app sections. Same fix, next round.
- `setup-checklist` and the import issues banner keep `rounded-2xl` (allow-listed by the guard).
