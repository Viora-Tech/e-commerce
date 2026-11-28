# Orders list: no stat cards, and only the order rows scroll

Branch `fix/orders-list-sticky` (from `origin/dev`). No issue. No migration.

## What changed

- The four stat cards (New orders today, Ready to ship, Pending UPI, Sales this week) are gone
  from the top of Orders (owner, 28 Nov). The title, the summary line ("1330 orders · 35 need
  shipping · 1 UPI payment pending") and More actions / Add order stay.
- `orders.listPage` no longer returns `tiles`; it returns `readyToShip` (the "need shipping"
  count of the summary line, the same where clause as `orders.toShipCount`). The aggregate drops
  the other tile columns (`orderListPage` in
  `packages/api/src/services/order-list-page.service.ts`). `orders.tiles` / `orderTiles` stay as
  an API and MCP action; nothing in the admin calls them any more.
- Removed: `components/orders/orders-tiles.tsx`, the `tiles` copy in `data/orders.ts` and its
  Hindi twin in `data/hi/orders.ts`. `StatStrip` stays (used by many pages). The Orders loading
  skeleton draws no stat strip (`tiles={0}`).
- Sticky layout, from `md` only (phones keep the normal page scroll): the page fits the panel's
  height; the page header, the table toolbar and the column header row stay put; only the rows
  scroll, inside the table card, and the pager stays in view under them. A short list keeps its
  own height (the card shrinks to fit, it does not stretch).
  - Opt-in props: `ProoflyListPage fill` and `ResourceTable fill`. Only Orders passes them.
  - `fill` sets `data-page-fill` on the PageBody; `admin-frame.tsx` (main) and
    `app/(admin)/template.tsx` turn into flex columns with `md:has-[[data-page-fill]]:…`, so the
    page gets a real height. Pages without the marker are unchanged.
  - `ResourceTable` with `fill` (classes in `resource-table/styles.ts`, `FILL`): the grid
    scroller scrolls both ways (the shadcn table container is made `overflow-visible`, the same
    trick as `ScrollSection`), the header cells are `sticky top-0` on `bg-card` with a 0.0625rem
    rule under them, and the first row drops its own top rule.
  - The bulk bar still sits over the header row outside the scroller, so it stays in view while
    the rows scroll sideways or down.

## Tests

- `packages/api/test/admin-page-statements.test.ts`: `orders.listPage` is compared with
  `list` + `tabCounts` + `toShipCount` + `apps.orderActions`; the stat-card counts test now
  calls `orders.tiles`. Not run here (tests run on `dev`).
- `packages/api/src/mcp/action-docs.generated.ts`: the `orders.listPage` line edited by hand to
  match the router's new JSDoc (the generator's biome step could not run in this worktree).
- `apps/admin` typecheck passed; biome clean on the changed files.

## Left to do / for the owner to check

- On localhost:3200 › Orders: no cards; scroll the rows and check the header, toolbar and column
  row stay; the pager stays at the bottom; tick rows and check the bulk bar; scroll sideways with
  many columns shown; narrow the window below `md` (48rem) and check the page scrolls normally.
