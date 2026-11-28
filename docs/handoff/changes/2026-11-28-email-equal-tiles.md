# Email tiles in one row are the same height

**Date:** 28 Nov 2026 · **Branch:** `fix/email-equal-tiles` · **Package:** `packages/notifications`

## Problem

The owner's "New order #2514" staff email showed two tiles under the title, "Order total ₹14,500"
and "Payment: UPI or bank transfer · unpaid", at different heights: the payment value wrapped to
two lines, and the colour sat on a box inside each cell, so each box was only as tall as its text.

## Fix

- `src/emails/blocks/boxes.tsx` `Stats` (the `stats` block): each tile is now the row's own `<td>`
  (React Email `Column`) carrying the background, padding, 8px radius, `height: 100%` and
  `valign="top"`. Cells in one table row always share a height, so every tile stretches to the
  tallest, in Gmail (web and app), Outlook desktop and Apple Mail. The gap between tiles is an
  empty 12px cell with class `k-gap`.
- `src/emails/layout.tsx`: phones (max-width 560px) turn `k-gap` into a 12px block, so stacked
  tiles get a clean 12px space between them. Before, stacked tiles touched and were shifted
  sideways by the old 6px side padding.
- `test/blocks.test.ts`: a regression test that the new-order tiles colour their own cells.

Other side-by-side blocks were checked and need no change: `columns`, the ticket's meta row
and the performance report's stats have no tile backgrounds (or borders on the cell itself);
`status`, `coupon`, `attachment`, `product` and the help box are one box split into cells.

## Templates that use the stats tiles

`staff_new_order`, `points_expiring`, `balance_request`, `cod_confirm`, `refund_issued`,
`return_refunded`, `staff_seo_weekly` (two or three tiles in a row), and `transfer_requested`
(one tile). With sample data, `points_expiring` ("Last day 30 November
2026" wraps) and `staff_new_order` with a manual-transfer unpaid order were uneven; both are
equal now. The rest can wrap with longer real values and are covered by the same block.

## Checked

Rendered all 64 templates (plus the owner's #2514 case) at 700px and 375px in headless Chrome
and measured every table row with side-by-side coloured or bordered boxes: before, 2 uneven
rows; after, none. Notifications tests pass, package typecheck passes, biome lint clean.
