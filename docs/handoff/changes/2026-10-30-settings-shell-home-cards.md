# 2026-10-30 — Settings shell (#147) and Home smart cards (#101)

## Settings, Shopify-style (#147)

- Inside `/settings/**` the main sidebar's list is replaced by the settings menu
  (`components/settings/settings-sidebar-nav.tsx`): "Back to admin", the settings search,
  Overview and the six groups from `SETTINGS_GROUPS`. The store switcher, domain pill and the
  member row stay, so the store name and domain sit on top as in Shopify. `admin-sidebar.tsx`
  swaps the list when the path is under Settings.
- `app/(admin)/settings/layout.tsx`: one narrow centred column (52rem), no second menu column.
  `settings-nav.tsx` is now phones only (search on the home, "‹ Settings" on pages).
- Settings home: every page as rows (icon, name, one line, ›) in one card per group.
- Row list + detail pattern: `settings-drill.tsx` + `settings-drill-panel.tsx`. A page opens on a
  short list of rows with their current value and a ›; a row opens its detail in place, "‹ Page"
  goes back. `?open=<row>` remembers it; an old `#anchor` opens the row with that id.
  Converted: **Checkout** (contact, address, minimum order, cash on delivery, branding: the old
  tabs are gone, `?tab=branding` links are now `?open=branding`), **Store details** (details,
  address, currency and time, store data; a row reads "Needs a fix" when its fields fail
  validation), **Customer accounts** (at checkout, ways to sign in, providers, more ways,
  deleting an account). Other pages are unchanged and still work in the new shell.

## Home smart cards (#101)

- Rules engine, pure and tested: `packages/core/src/home-cards/rules.ts` (`buildHomeCards`,
  `staleCollectionReason`), tests in `rules.test.ts`. Cards hold numbers and names only; the admin
  writes the words (`data/home.ts` `suggest`, Hindi in `data/hi/home.ts`).
- Rules, best first (max 6): old unfulfilled orders (oldest > 3 days) → Orders · Unfulfilled;
  best seller running out (≥ 5 sold in 30 days, at or under the low-stock threshold, days left at
  this pace) → product; busy product page that does not sell (≥ 100 landing sessions in 30 days,
  < 1% added to cart) → product ("improve its media"); live collection out of season (festival or
  season words with their months, e.g. Raksha Bandhan in Jul–Aug) or with an old year in its name
  → collection ("unpublish"); abandoned checkouts (≥ 3 this week) → Abandoned checkouts; product
  trending (revenue ≥ +100% on the 30 days before, ≥ 3 units) → opens Ask AI with a request to
  propose changes; repeat buyers (≥ 10 customers with 2+ orders and no such segment) → New
  segment pre-filled with "orders ≥ 2".
- Facts and storage: `home-cards/service.ts` (`homeCardFacts`, `refreshHomeCards`,
  `listHomeCards`, `dismissHomeCard`). Tables `home_card` (one row per card key, `dismissed_at`)
  and `home_card_run` (last refresh per store), migration `0195_home_cards` with the
  `stores_with_home_cards_due()` SECURITY DEFINER function and `apply_store_rls()`.
- Worker: `apps/worker/src/home-cards.ts`, hourly job `{home}-cards`, rebuilds every store whose
  cards are 20 hours old. Home also rebuilds on open when the last run is over 26 hours old.
- API: `dashboard.cards` and `dashboard.dismissCard` (analytics.read). Dismissing hides a card for
  the whole store for 30 days, Undo brings it back.
- Home: `suggestions.tsx` renders the smart cards, then the WhatsApp / Reviews set-up ideas if
  there is room. The canned "Write product descriptions" and "Plan a sale" cards are gone.

## Not done

- Other settings pages (Payments, Shipping, Notifications, Taxes…) keep their current layout.
- Product page sessions count landing sessions only (the session's first page), not every view.
