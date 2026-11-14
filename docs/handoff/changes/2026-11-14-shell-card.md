# 2026-11-14: one page shell and one card (design audit steps 4 and 5)

Branch `design/shell-card`. Audit merge-plan steps 4 and 5 (admin-ui-audit, section 6.2).

## Step 4: one page shell

- `layout/page-body.tsx` is the one shell. `width` now works: `full` (default, lists),
  `detail` 75rem, `settings` 68rem (Home, Settings, Account), `form` 52rem (market, catalog,
  rollout), `narrow` 48rem (not found, pick a store, file storage, app install picker). Every
  width but `full` is centred. One rhythm on every page: `px-4 md:px-6`, `pt-4 md:pt-5`, `gap-6`,
  `pb-6 md:pb-8` (was `gap-5`, `pb-5 md:pb-6`). It passes other div props through (`aria-hidden`).
  The old `wide` / `frame` values are gone; every caller moved.
- `ProoflyListPage`, `ProoflyDetailPage`, `ProoflyPageBody` and `orders/order-page-frame` are thin
  wrappers on PageBody. `LIST_PAGE_FRAME` is still exported for ListPageSkeleton but adds nothing.
- `layout/page-columns.tsx` is the one column layout (fluid main, 23.5rem side, `gap-6`, takes
  `sideAs`, drops the side track when there is no side column). ProoflyDetailPage and the order
  frame use it.
- The 15 hand-copied shells (analytics overview, report, answer x2, reports home, query report,
  three bulk editors, bulk write, variant page, campaign editor and report, links, automation
  editor) are `<PageBody>` (`width="detail"` for variant page and bulk write).
- The four hand-made two-column grids are PageColumns: customer segment form (was 22rem at xl),
  Delhivery overview (22rem), WhatsApp setup (22.5rem), privacy data request (20rem).
- Callers that re-stated the rhythm in `className` (`gap-6 md:pt-5 md:pb-8`, `gap-4`, `gap-8`,
  `mx-auto max-w-[…]`) now pass `width` only. Home keeps its own `gap-10` on purpose.
- DetailPageSkeleton already renders ProoflyDetailPage, so it now draws the same PageBody detail
  frame as the order, product and customer pages.

## Step 5: one card

- ui `Card` radius `rounded-xl` → `rounded-lg` (0.75rem), the same as DataCard (and the image and
  footer corners inside it).
- `layout/chart-card.tsx` is a DataCard with a chart body: title `text-card-title`, subtitle the
  DataCard grey line, the period toggle as the card action, the kebab as the DataCard menu.
- Analytics on DataCard: breakdown, funnel, sales breakdown, top products, visitor list and the
  report chart (metric label as meta, total + delta as title, comparison as action). Report tiles
  on Reports home and saved report cards are clickable tiles: `surface-card card-lift rounded-lg`.
  Kept on ui Card (same radius now) because they have no title: the answer snapshot note, the
  report-view controls bar, the visitors empty state and the floating glass cards on Live view.
- Hand-made titled panels moved to DataCard: affiliate trend + products, affiliate codes,
  back-in-stock demand, COD/RTO pincodes, delivery options price and courier list, Shopify CSV
  help, Delhivery connection, pickup locations and recent shipments.
- Radius: about 90 card-like panels (`surface-card` panels and `border bg-card` cards on app
  pages, settings, themes, media, metaobjects, menus, bulk grids, inbox, create shipment,
  markets) went from `rounded-xl` / `rounded-2xl` to `rounded-lg`; DataCards that forced
  `rounded-xl` on the customer page and segment pages lost that override.

## Left alone (other steps own them)

Popups, drawers (pickup drawer), banners (status banner, health line, setup checklist, warning
cards), skeleton internals (the card-shaped `rounded-2xl` Skeletons in settings and inbox),
editor chrome (themes customize, automation canvas), chat bubbles and pickers' dropdown lists.
