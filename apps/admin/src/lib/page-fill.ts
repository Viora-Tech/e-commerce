/**
 * "Only the rows scroll" (owner, 28 Nov 2026). A `ResourceTable fill` marks its card with
 * `data-page-fill`; from `md`, every box between the admin panel (`main`) and that card carries
 * PAGE_FILL_CHAIN, so it turns into a flex column that takes the room left and may shrink. The
 * card then fits the panel's height and the table scrolls its rows inside itself, under a
 * fixed page header, toolbar and column row. A page with no such table is not affected.
 * Phones keep the page scroll.
 *
 * On the chain: `main` (admin-frame), the (admin) template, PageBody, AppShell's wrappers, and
 * any page-own wrapper around the table.
 */
export const PAGE_FILL_CHAIN =
  'md:has-[[data-page-fill]]:flex md:has-[[data-page-fill]]:min-h-0 md:has-[[data-page-fill]]:flex-1 md:has-[[data-page-fill]]:flex-col'
