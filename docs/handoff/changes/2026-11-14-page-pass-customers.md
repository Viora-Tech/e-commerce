# Page pass 4: customers list, customer page and segments (audit section 7, row 4)

Branch `design/page-customers` (from 6e54fc581). Visual and UX consistency only: every action,
number and flow stays the same.

Already done before this pass (wave 1 and 2): PageBody is the one shell (gap-6, 1.5rem gutter),
PageColumns has the 23.5rem side column and gap-6, the two customer pickers were merged.

## What changed

- **Customers list** (`/customers`): on the ProoflyListPage template (header, stat tiles, table)
  like Orders. A failed read now shows in the table body with Try again under the same header
  (ResourceTable `error`), not a whole-page error that replaced the table.
- **Customers list loading**: its own `CustomersListSkeleton` (the real title, three header
  buttons, four stat tiles and the real ResourceTable with the customer columns), like
  `OrdersListSkeleton`, instead of the generic list skeleton.
- **Customer page** (`/customers/[id]`): on ProoflyDetailPage (75rem, 23.5rem side column), which
  also gives it `?focus=` like the other detail pages. Loading skeleton now matches: detail frame,
  three header buttons, the four-tile summary strip (was three), 4 main and 6 side cards.
- **Next step** card on the customer page: drawn with the shared NextStepBanner (as on the order
  page) instead of its own rounded box. Same suggestion, same buttons.
- **Orders card**: the hand-built grid table is now SimpleTable rows (row opens the order, the
  order number is a link) and the count uses DataCard's count badge. The trailing arrow is gone,
  as on every list (owner: no open arrow).
- **Store credit card**: loads through `useLoad`; while loading it draws a balance row and two
  lines instead of an empty card, and a failure shows Try again (or no-access) instead of plain
  text. Add/remove still re-reads the balance.
- **Tags card**: the tags are StatusChips with the remove x, as the product tags draw them.
- **Segments list** (`/customers/segments`): on ProoflyListPage; the table is SimpleTable inside
  the list's table card, rows open the segment, the row menu uses RowActionsCell. The delete
  confirm stops clicks from reaching the row (`stopPropagation`).
- **Segment builder** (`/customers/segments/new`, `/customers/segments/[id]`): on
  ProoflyDetailPage (it was full width with the old columns); the name field sits in a DataCard
  titled "Details" (new copy `segmentsContent.builder.details`; the builder copy is untranslated
  in Hindi as a whole, as before). Loading skeletons now use the detail frame with 2 main cards and
  the preview side card.

## Tests

- `components/customers/customers-list-skeleton.test.tsx`: same header cells and row heights as
  the loaded table, real title, four tiles.
- `components/customers/segments-list.test.tsx`: table header, one row per segment, the row link,
  the empty state.

## Left alone

- Gift cards card and the email suppression notice still appear only when there is something to
  show (no fixed-height placeholder: most customers have neither, so a placeholder would itself
  jump away).
- Segment builder keeps both the header Save and the SaveBar (settings step 9 decides one save
  pattern for all pages).
- Merge dialog's keep-this-or-that cards keep their own label tiles (they are radio cards).
