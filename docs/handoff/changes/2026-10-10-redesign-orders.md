# Admin redesign: Orders

Branch `feat/proofly-orders`. Orders area in the Proofly look (Figma `YmMNC5JOimqg61sI0eFI5a`, Orders list
`241:3`, Order detail `242:332`, Drafts `243:602`, "Order · Next step" `267:4179`). Presentation only; every action,
query and permission is kept.

## What changed
- **Orders list**: title and plain-language summary line, four stat cards (new orders today, ready to ship,
  pending UPI, sales this week; Ready to ship and Pending UPI filter the table), segmented tabs with counts,
  rows per page (`?perPage=`), coloured chips only where action is needed, centred status columns, row actions
  (open + menu).
- **Order detail**: new header (back link, chips, "Placed 6 days ago · Payment: ..."), Print and the menu, and a
  **Next step card** driven by the order's real state (`order-next-step-kind.ts`): check UPI payment, collect
  payment, pack and ship (COD wording only while cash is owed), on its way (4-step tracker), delivered,
  cancelled. Items, summary, payment, customer (WhatsApp and Call buttons), tags restyled as cards. The floating
  action bar is gone (the Next step card owns the action).
- **Drafts, Abandoned checkouts, Returns, Shipments**: same frame, chips, dates, rows per page. Drafts get three
  stat cards. Returns detail uses the new frame. Draft editor gets the new page width.
- **API (read-only, no migration)**: `orders.tiles` (list stat cards) and `orders.draftTiles` (drafts stat cards).
- Shared: `StatTile` gained an optional `note`; `lib/rows-per-page.ts` (`parseRowsPerPage`); copy for next step in
  `data/order-next-step.ts` with a Hindi overlay.
- `admin-routes` sweep allow-list lowered for the seven files migrated to `routes.*`.

## Not done / gaps
- Courier option cards (price and ETA per courier) on the Pack and ship card: the order page can only book with the
  store default courier, so the card offers "Fulfil items" and "Compare couriers" (links to Shipments).
- "View invoice" and "Reopen order" buttons: no such actions exist, so they are omitted.
- No UPI ID row on the UPI card (not stored); it shows when the reminder was sent.
- Drafts tabs (All / Open / Invoice sent): the list has no server filter for them, so tiles show the split instead.
- `components/orders/orders-list-frame.tsx` is a local list shell; swap to the shared Proofly list shell when it lands.
- Not checked in a browser or against Figma by the agent (extension unavailable); owner reviews on localhost.
