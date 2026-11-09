# Detail pages: the shorter column stays in view

`StickySideColumn` is replaced by `components/layout/sticky-columns.tsx` (`StickyColumns`), which
draws both columns of a detail page and keeps whichever is shorter in view on desktop (#1301).
The customer page, whose side column runs longer than its main one, now keeps the main column in
view instead of leaving an empty stretch beside the side cards. A tie keeps the side column.

- Same offset rule as before: 1.5rem from the top when the column fits on the screen, otherwise
  bottom-aligned so its last card stays reachable. Measured with a ResizeObserver on both columns
  and the scroller.
- Kept: every card keeps its full height (`*:shrink-0`, #671) and no column scrolls on its own
  (#1057).
- Callers: `PageColumns`, `ProoflyDetailPage` and `OrderPageFrame` pass their grid classes and gap.
  Mobile stays stacked, main first.
- Test: `sticky-columns.test.tsx`.
