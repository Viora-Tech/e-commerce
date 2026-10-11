# Scrollable long card sections

New `apps/admin/src/components/layout/scroll-section.tsx`: a long list inside a card gets a max
height (default `min(28rem, 60vh)`) and scrolls inside itself. Thin scrollbar, sticky table
header (`thead th`) or `header` node, edge fades (a CSS mask, so it works on any background),
footer "Showing N items · scroll for more" with "Show all" / "Show less" (remembered per `id`
for the session), keyboard focusable section with an aria-label. Content that fits keeps its
natural height and shows no footer. Below `md` it never traps the page scroll: the list is
clipped with a fade and "Show all" opens it. Copy: `layoutContent.scroll` (+ Hindi).

Applied to: Shopify import run page (What stays in Shopify, sample rows, problem groups,
every-record problems table), theme import report (sections table, pages list, swaps table,
to-do list), order timeline, product stock history, gift card history.

Left alone on purpose: order and purchase-order line items (editable or must be read in full),
customer activity and messages (already capped with "Show more"), type grid (at most a dozen cards).
