# Delivery options: the four app pages to Figma, and the automatic courier list

Branch `feat/delivery-options-pages`. Figma file YmMNC5JOimqg61sI0eFI5a: 929:11373 Overview,
929:11812 Options, 938:12101 Options (automatic courier list), 929:12240 Routes, 929:12840 Product
rules. No migration.

## Admin (apps/admin/src/components/apps/delivery-options)

- **App bar**: `header-action.tsx` (registered as the app's `HeaderAction`) draws the status pill
  ("3 courier apps · 98% of checkouts priced live today", from `deliveryOptions.status`; it needs
  Redis, which the shell's `appBar` read cannot reach) and **Preview checkout** (a dialog with
  the cards a shopper at a PIN sees now). The manifest's new `appBar` (`app-bar.ts`, one
  statement) puts the option and rule counts on the sidebar entries.
- **Overview** (`overview-page.tsx`): four tiles (priced live, fell back to zone rates, typical
  answer time, shoppers picking Express), "At checkout now" for PIN 560038 / 2 kg / ₹2,499
  prepaid, the Courier apps card (Answering / Skipped chips), Try a PIN (unchanged).
- **Options** (`options-page.tsx`): "Courier list (automatic)" or "Fixed options", Save in the
  head (one `saveOptions` call: every option, the order and the layout in one transaction).
  Fixed: one card per option (drag, on/off, Picked by default, Picks / Shopper pays / Payment /
  Shows), the fallback note; the option's own page stays for advanced fields ("Shopper pays →
  more settings", or the name). Courier list: "Couriers shoppers may see" (switches, Included in
  price, New), "What the price includes" and a live preview of the unsaved edits.
- **Routes** (`routes-page.tsx`): one table of every courier × app, All / Direct / Via
  aggregator, Courier name and On switches (saved as `carrier:<carrier>|channel:<app id>`
  route settings, merged with what is saved), a row opens the route setting dialog. Delhivery
  Protect and Insurance cover stay below.
- **Product rules** (`rules-page.tsx`): drag to reorder (saved at once), chip chain target →
  options → routes, plain-English line, Edit; Delete moved into the rule dialog.
- Copy: the pages' copy is in `data/delivery-options-pages.ts` (Hindi in
  `data/hi/delivery-options-pages.ts`); `delivery-options.ts` had reached the 500-line cap.
- Removed: `options-card.tsx`, `routes-card.tsx`, `rules-card.tsx`, `app-health-line.tsx`.

## Engine and API (behaviour unchanged unless the new settings are used)

- `config.ts`: `couriers.allow` (null = every courier, as before), `couriers.known`,
  `couriers.extra` (`difference` default | `none`), `courierId()`, `DELIVERY_LAYOUTS`;
  `DeliveryConfig.layout` (absent = `fixed`). Old rows parse with these defaults.
- `resolve.ts`: a courier not in `allow` is dropped as `not_allowed`; `extra: 'none'` lists faster
  couriers at the pick's price; `layout: 'list'` shows only the first enabled option, as a list
  (other options hidden with the new trace reason `list_layout`). Tests in `resolve.test.ts`.
- `service.ts`: the layout lives in the app's own settings beside the Protect card
  (`saveDeliveryLayout`); `fixed` stays out of the config, so stores that never chose keep their
  config version.
- `health.ts`: `DeliveryHealth.typicalMs` (all apps), `AppHealth.failures`.
- `admin.ts`: `deliveryRouteCatalogue` (the Routes list: each connected app asked origin → 110001
  and → 560001, 500 g, ₹1,000, through checkout's 6 h answer cache, no breaker or health writes),
  `deliveryExpressShare` (last 30 days of orders with an option, not cancelled/draft/test),
  `tryDeliveryPin` takes a `draft` (unsaved layout and options) and an optional cache.
- Router `deliveryOptions`: `status`, `routeCatalogue` (settings.read), `saveOptions`
  (settings.manage); `overview` adds `express`; `tryPin` takes `draft` and `cached`.

## Not verified here

No Postgres on the build machine: `layout.test.ts` (layout save/load, app bar counts) and the
Express share SQL have not run; the pure engine, health and admin tests have.
