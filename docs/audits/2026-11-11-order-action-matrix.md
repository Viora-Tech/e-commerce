# Order action matrix (11 Nov 2026)

Every order action, everywhere it is offered, checked against four questions:

1. **Offered right**: shown only in the states (and to the members) where it can work.
2. **Asks right**: asks what it must before it acts (courier and tracking, reason, refund route).
3. **Looks right after**: badges and the menu move on (the menu now offers the opposite action).
4. **Books right**: order status, fulfilment status, `order_line.fulfilled_quantity` against its
   parcels, stock held and on hand, shipments, payments.

How it was tested:

- **Database**: `packages/core/src/order/action-matrix.test.ts` chains the actions the way staff
  press them, on a real database, and after every step checks five invariants: each line's
  packed count equals its parcels' packed count; stock held equals the live order's unpacked
  units in open parcels; on hand dropped by exactly the units packed; a recompute changes nothing
  (stored statuses are what the facts derive); an order with nothing packed has no live shipment.
  15 scenarios, all passing after the fixes below.
- **Menus**: `apps/admin/src/lib/order-next-move.test.ts` (which move and which undo each state
  offers, in both menus) and `packages/api/test/permissions.test.ts` (who may pack).
- **Local admin, by hand** (port 3200, the two local orders, put back exactly as they were
  afterwards): COD order row menu and More actions at unfulfilled, fulfilled, delivered; pack
  form with courier and tracking; Mark as delivered and Mark as not delivered; Mark as
  unfulfilled from the order page and from the row; the drifted order (#1535) unstuck; cancel
  (reason, restock, notify) and Restore order on a UPI order. Stock and parcels checked in the
  database after each step.

Places: **Row** = orders list row menu, **Page** = order page More actions and header buttons,
**Card** = order page cards (Next step, Unfulfilled, Payment, Shipment), **Bulk** = orders list
selection bar, **Ship** = Shipments page / shipment details. There are no order actions in the
command palette or keyboard shortcuts (only "G O" to open Orders and "N" for Add order); the AI
assistant and MCP reach the same API procedures and inherit the API's checks.

Result key: **Pass**, **Fixed** (bug found and fixed in this round, issue linked), **Open**
(found, not fixed: needs an owner decision or is out of scope), **n/t** (not tested by hand;
covered by code reading only).

## Matrix

| Action | Places | Offered right | Asks right | After | Books | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Mark as paid | Row, Page, Card, Bulk | COD was offered Mark as paid before it was even packed | Opens Collect payment (how, reference, date) in Row and Page; Bulk marks paid without asking | Paid badge | Payment row captured | **Fixed** #1532 (COD order) |
| Mark as fulfilled (pack form) | Row → Page `?fulfil=1`, Page, Card | COD orders never offered it in the menus; held orders offered it and failed | Courier, tracking number, tracking link (Other), notify | Fulfilled; menu then offers Mark as delivered + Mark as unfulfilled | Line = parcels; stock leaves on hand and held | **Fixed** #1532 |
| Mark as fulfilled (Bulk) | Bulk | Open orders with something left to pack | One courier, tracking per order, Notify customers | Fulfilled | Same as the pack form (db test) | **Done** (owner answer 2) |
| Mark as fulfilled on a packed order (cancelled booking) | Page | | Opened an empty pack form | | | In PR #1513 (#1512) |
| Mark as unfulfilled | Row, Page | Hidden when lines read packed but status read Unfulfilled (#1535); Page did not check Orders: fulfil | Refused while a courier label is live, or when delivered (says why) | Back to To ship; Next step "Pack and ship" | Unpacks parcels and lines, stock back; typed tracking closes | **Fixed** #1535, #1533 |
| Mark as unfulfilled on a drifted order | Page | | | Refused "Nothing on this order is packed" | Line said packed, parcel and stock said not | **Fixed** #1535 |
| Mark as delivered | Row, Page, Card, Bulk | COD never offered it in the menus | Confirm "Mark #n as delivered?" with Notify customer | Delivered; Collect for COD; menu offers Mark as not delivered | Parcels read Delivered; packs what is left | **Fixed** #1532 (COD); confirm with Notify customer **Done** (owner answer 1) |
| Mark as delivered (Bulk) | Bulk | Only orders packed or on their way; the rest skipped and counted | Asks nothing | Delivered | API refuses unshipped (`onlyShipped`, db test) | **Done** (owner answer 2) |
| Mark as not delivered | Row, Page | Page did not check Orders: edit | | Back to Fulfilled / tracked status | Courier-reported deliveries left alone | **Fixed** (gate) |
| Create shipment | Row, Page, Card | Row offered it on held orders and to members without Orders: fulfil | Courier drawer (#1500) | Fulfilled, label | Parcel packed | **Fixed** #1533 |
| Cancel shipment | Row, Page, Ship | Row offered it for a typed tracking number or no shipment (ended in "Courier ... is no longer enabled"); Row missed part-packed orders with a label | Confirm dialog | Back to To ship | Parcel unpacked, stock back; tested book → cancel → book → cancel | **Fixed** #1533 |
| Mark as paid / fulfilled / delivered via API | API, MCP, assistant | `orders.setStatus` packed with Orders: edit only | | | | **Fixed** #1534 |
| Hold / release fulfilment | Page, banner | Pass | Reason | Hold banner; packing refused until released | No stock moves | Pass (db) |
| Cancel order | Row, Page, Bulk | Open and not packed, or packed under a live label | Reason, note, restock, notify, refund route | Cancelled + Voided, archived | Stock back (or written off); tested part-packed and written-off | Pass; with a live label: "Also cancel courier label" **Done** (owner answer 3) |
| Restore order | Row, Page | Cancelled only; refused once money went back | Asks nothing | Open again, unarchived, Next step back | Stock held again; part-packed restore checked | Pass |
| Refund | Page, Payment card | Captured payments | Amount, reason, route | Payment badge | n/t by hand (core refund tests exist) | n/t |
| Edit order | Page | Open or completed | Edit page | | Tested edit up and down after a part pack: books agree | Pass (db) |
| Duplicate order | Row, Page | | Opens a draft | | n/t | n/t |
| Archive / unarchive | Row, Page, Bulk | | | Off the working tabs | | Pass |
| Add / remove tags | Row, Bulk, Tags card | | Tag input | | | n/t |
| Send payment reminder | Row, Page, Bulk | Manual UPI, unpaid | Review email, channel | | | Pass (offered right) |
| Send order link, View status page, Copy number | Page / Row | | | | | n/t |
| Print packing slip / invoice / pick list | Page, Bulk | | | | | n/t |
| Collect / capture payment | Payment card | | How, reference | | | n/t |

## Bugs found and fixed

- **#1532** Cash-on-delivery orders were offered **Mark as paid** at every stage in More actions and
  the row menu; **Mark as fulfilled** and **Mark as delivered** never showed for COD (the Next step
  card already knew COD never blocks packing). Held orders were offered Mark as fulfilled, which
  then failed. `nextOrderMove` now takes cash on delivery, the hold and the packing grant.
- **#1533** The row menu offered **Cancel shipment** where there is no courier label (typed tracking
  or none), offered **Create shipment** on held orders, and showed packing actions to members
  without Orders: fulfil. It now follows the order page's rules (the list returns `labelLive`).
- **#1534** `orders.setStatus` with `fulfilled` or `delivered` packed an order with only Orders:
  edit, while the pack form needs Orders: fulfil. Both now need Orders: fulfil.
- **#1535** An order whose line read packed while its parcel and stock did not (a cancelled label
  from before parcels; found on the local copy) could not move: nothing to pack, and Mark as
  unfulfilled said nothing was packed. Mark as unfulfilled now also shows when lines read packed
  under an Unfulfilled status, and puts the line back in step with its parcels (no stock moves:
  the stock followed the parcels).

## Owner decisions (answered 11 Nov, built in the same PR)

1. **Mark as delivered asks first** everywhere it is offered (More actions, the Next step card,
   the row menu): "Mark #n as delivered?" with **Notify customer** (on by default). Off, the
   `order.delivered` event carries `notifyCustomer: false` and the shopper hears nothing.
   (`mark-delivered-dialog.tsx`, `changeOrderStatus(..., { notifyCustomer })`.)
2. **Bulk Mark as fulfilled** opens a form: one courier for the selection (the pack form's list,
   or a typed name), an optional tracking number per order on screen, Notify customers. Each order
   packs everything left through `orders.fulfilAll` (the pack form's checks: hold, balance due,
   cancelled). **Bulk Mark as delivered** only hands over orders already packed or on their way;
   the rest are skipped (rows on screen without a call, others refused by the API with
   `onlyShipped`) and the toast says how many. The bulk-edit sheet's Mark column uses
   `onlyShipped` too.
3. **Cancel order with a live courier label** shows "Also cancel courier label (AWB …)", ticked
   by default (locked on when everything is packed under it). Ticked, the API cancels the label
   with the courier first (the Cancel shipment path, which unpacks it), then the order; if the
   courier refuses, nothing is cancelled and the error shows. Cancel order is now offered on an
   order packed under a live label (order page and row menu).
4. **Cancelled orders' payment**: nobody paid reads Voided in the list and header, and the Payment
   and Transactions cards show no status for the open attempt (no "Payment pending" under
   Voided). Money still held reads **Refund due**; all of it back reads Refunded.

Browser check for these four is owed: the PC was under 1 GB free, so they were verified with
tests, typecheck, biome and sweeps only.

## Notes (not bugs, worth a look)

- **A.** A typed tracking number reads "Picked up · Now" in the Next step stepper and "Label created"
  in the list's Delivery column straight after packing, though nothing was picked up and no label
  bought.
- **B.** Where the line/parcel drift itself comes from is still not found in code: every pack and
  unpack path moves both. The 15 scenarios above keep them equal. The separate drift audit
  (production data) should look for orders packed before parcels existed and for hand fixes.
- **C.** The Next step card's Mark as delivered and the bulk bar do not hide for members without
  Orders: fulfil; the API refuses them now (#1534), with an error toast.
