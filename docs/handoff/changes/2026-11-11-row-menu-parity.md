# 11 Nov 2026: orders list row menu matches the order page (#1501)

- **Mark as paid** from the list opens the order page's Collect payment dialog (`?collect=1`), as
  Mark as fulfilled opens the pack form (`?fulfil=1`): both ask, wherever they start.
- **Undo actions in the list**: Mark as unfulfilled, Mark as not delivered, Restore order, with
  the same calls and refusals as the order page.
- **One rule for both menus**: `orderUndos` (lib/order-next-move.ts) decides which undo actions
  an order offers; both menus read it, so they cannot drift apart again. Tests:
  `order-next-move.test.ts`.
