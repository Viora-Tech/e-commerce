# Home: set-up cards hide when done, adjustable to-dos (#1005, #1006)

## Finish setting up (#1005)

`components/home/finish-setup.tsx` returns nothing once all three steps are done (a product,
a payment gateway on live keys, a courier). While any step is open the section shows as before,
with finished steps ticked.

## To-dos (#1006)

- The merchant picks which to-dos Home shows: an "Edit to-dos" button on the To do heading opens
  a dialog (`components/home/edit-todos-dialog.tsx`) with one checkbox per item. Saved for the
  whole store in `store.preferences.homeTodos = { hidden: HomeTodo[] }` (no migration). Only the
  hidden ones are stored, so a new item shows for every store by default.
- The list of items: `@commerce/core/home-todos` (`HOME_TODOS`, `parseHomeTodos`). API:
  `dashboard.todos` / `dashboard.setTodos` (analytics.read, like `dismissCard`), service
  `packages/api/src/services/home-todos.service.ts` (writes only its key with `jsonb_set`).
- New counted items in `dashboardSummary().needsYou`:
  - `unpaid`: payments to collect, the Orders "Unpaid" tab rule (`viewFilter('unpaid')`, COD included).
  - `preorderShipSoon`: active pre-order campaigns whose ship date is in the next 7 days.
  - `returnsToReview`: return requests still `requested` (the Returns "Requested" tab).
- Items with a count of 0 stay hidden, as before. No free-text to-dos.
- "Unfulfilled orders" was not added as its own item: "Orders to ship" already counts the
  Unfulfilled tab.

## Test

Home with a fully set-up store: no "Finish setting up". Click "Edit to-dos", untick "Orders to
ship", Save: the card goes (if it had a count), reopening the dialog keeps it unticked, other
members of the store see the same. Create an unpaid COD order, a return request, or an active
campaign shipping within 7 days: the matching card appears.
