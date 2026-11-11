# 11 Nov 2026: order actions audit and the courier drawer (#1496–#1499)

Owner found basic gaps in order actions on 11 Nov; fixed together.

- **Mark as fulfilled asks for tracking (#1496).** The order page's More actions and the orders
  list's row menu no longer pack straight away: they open the order page's pack form (courier,
  tracking number, and for "Other" an optional tracking link; Notify customer). The list opens
  `/orders/<id>?fulfil=1`.
- **Mark as unfulfilled (#1496).** `undoPacked` (core `order/undo-packed.ts`,
  `orders.markNotShipped`): packed items back to To ship and stock. Refused while a courier label
  (one with a label URL) is live: cancel the shipment first. A tracking number typed by hand has
  no label and closes with the unpack. Fixes #2424's state (a label cancelled before the 10 Nov
  fix left items packed).
- **Restore order (#1497).** `restoreCancelledOrder` (core `order/restore-order.ts`,
  `orders.restore`): a cancelled order opens again and its parcels hold their stock again.
  Refused once money or store credit went back (a refund row, a cancelled store-credit hold).
  Units written off at cancel ("Restock" off) are held again from what is on hand. The cancel
  dialog no longer says the order cannot be reopened.
- **Cancel shipment in both menus (#1498).** Same rule: a live courier label. On the order page
  it shows while the label is live and says why when the courier no longer takes the cancel; the
  list hides it once delivery status is cancelled, delivered or returned.
- **Biggest box for mixed parcels (#1499).** `parcelBoxPreset` and `resolveParcelPackage` pick the
  biggest of the products' boxes instead of the default box (glasspad + skates ship in the
  glasspad box).
- **Courier drawer as in Figma 898:7790 (#1499).** `courier-drawer.tsx` (the UI package's
  Drawer with a swipe handle) and `courier-table.tsx`: Shipping insurance toggle (sent as
  `insured` on booking; defaults to the checkout choice), All / Air / Surface tabs, Sort
  (Recommended, Cheapest, Fastest), table (courier with badge, delivery date and days, charged
  weight, charges, Ship now) and the picked row's price breakdown. Book shipment opens the drawer
  until a courier is picked there. Not in the table yet (no data): courier rating and pickup day.

Tested: core order/shipping tests, admin shipment/order tests (new: courier sort and mode,
tracking link, link-row), API order and shipping tests, sweeps. Clicked through on a local admin:
Restore order, Mark as fulfilled (pack form), Mark as unfulfilled, Book shipment opening the
drawer, the no-courier state.
