# Orders list: first page of the admin design pass

Owner approved on 14 Nov 2026 (design audit, section 7, page 1). Visual consistency only: the
Orders list's data, filters, actions and URLs behave as before. Builds on the quick wins (#1688).
The Orders list is now the reference for every ProoflyListPage list.

## Loading screen matches the loaded page

- `orders/loading.tsx` renders `components/orders/orders-list-skeleton.tsx`: the real page title
  (PageHeader), bars for the summary line and the two header buttons, the four-cell stat strip
  with skeleton figures, and the real `ResourceTable` in its loading state with the Orders
  columns, default hidden columns, saved column choice, view select, filter, sort and columns
  buttons. Header labels, column widths, the 2.5rem header and 3.75rem rows are the loaded
  table's own, so nothing moves when the orders arrive (was: a 2rem header, four loose 6rem
  tiles in a 2×2 grid, a two-row 6.25rem toolbar and 3rem rows; the table dropped ~7–8.5rem).
- The table settings both use live in `lib/order-list-table.ts` (default sort, columns key,
  hidden columns, `?sort=` parse and write).
- The other Orders routes (drafts, abandoned checkouts, returns, shipments, packing slips, bulk
  edit) get their own `loading.tsx` with the shared list skeleton, so they do not borrow the
  Orders one.

## Shared pieces (used by other lists)

- `layout/list-page-skeleton.tsx` is rebuilt from the real parts: the ProoflyListPage frame
  (`LIST_PAGE_FRAME`), `layout/page-header-skeleton.tsx` (title line 2.25rem, summary 1.25rem,
  2.25rem button bars), `StatStrip` with placeholder cells, and
  `table/resource-table-skeleton.tsx` (toolbar row, header and rows at ResourceTable's heights).
  New optional props `title`, `actions`, `tiles` (default 4, as before) and `table`. The 20 other
  routes that render `<ListPageSkeleton />` keep working and now get the real heights; lists
  without a stat strip should pass `tiles={0}` when their page is done.
- `table/resource-table/styles.ts`: the toolbar row, control height, header and cell classes in
  one place, used by the table, the toolbar and the skeleton.
- `StatTile`: label `text-caption font-normal`, figure `text-stat` (1.875/2.25rem; was an
  arbitrary 1.75/2.125rem, so the strip is 0.125rem taller), note `text-period`. New `loading`.
- `StatStrip`: `loading` now draws skeleton cells (was `aria-busy` only; affects Growth and
  Analytics KPI strips while they refetch) and turns off tile filtering while loading; new
  `placeholders` for a strip with no tiles yet.
- `ResourceTable`:
  - new optional `error` prop: a failed read shows "Could not load …" with Try again in the
    table body under the header row, hides stale rows and the pager, never the empty state;
  - empty, no-results and error are one `TableFeedback` (EmptyState) component;
  - skeleton rows use `TableSkeletonRows` (was a copy) and, on a refetch, keep the number of
    rows already on screen, so the pager does not jump;
  - toolbar controls (view select, search bar, Filter, Sort, Columns) are 2.25rem (were 2rem);
    search text, pager text, header and chip text use tokens (`text-caption`, `text-period`);
  - rows-per-page button is the default 2.25rem Button, like the page buttons beside it;
  - the No results "Clear filters" button is the default size.
- `ActionMenu`: new `buttonSize` (`default` | `sm`) for the `button` trigger; default unchanged.
- `StatusChip`, `order-lines-popover`, `lib/order-columns.tsx`: `text-xs` / `text-[0.8125rem]`
  → `text-period` / `text-caption font-normal` (same sizes).
- `data/states.ts`: the error state's button reads "Try again" (was "Retry"), per the copy rule.

## Orders page itself

- A failed read shows in the table with Try again, which reads the list again (was a banner
  above the old rows whose Try again did not refetch).
- A search or filter with no match shows "No orders match" + Clear filters (the copy existed but
  was never shown; the generic "No results" showed).
- Bulk bar: Mark as is an ActionMenu like More actions; both at the bar's 2rem `sm` height.
- Frame: `gap-6 pb-6 md:pb-8` on PageBody's 1rem / 1.5rem gutter (drops a duplicate `md:pt-5`;
  phones get 0.25rem more bottom space).

## Left as is (reasons)

- The bulk bar stays at 2rem buttons: it replaces the 2.5rem table header row.
- Filter chips stay rounded pills (an interactive filter, not a status); row chips already use
  StatusChip (OrderChip).
- Other lists' `loading.tsx` files still draw four placeholder tiles; set `tiles` per page in
  their own design-pass PRs.

## Checks

`bun run typecheck` (admin), admin vitest (176 files, 997 tests; new
`layout/list-page-skeleton.test.tsx` and `table/resource-table/table-feedback.test.tsx`),
`bun run lint` 0 errors, `bun run test:sweeps` all pass.
