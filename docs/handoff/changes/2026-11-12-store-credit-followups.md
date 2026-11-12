# Store credit follow-ups (#1571)

The owner's four follow-ups after store credit steps 1–4 (#1286, #1307, #1334, #1559). Built
in-house on our own ledger (same radar decision as step 1); nothing copied.

## 1. Draft invoice email shows the credit

- `packages/core/src/notifications/store-credit-data.ts` → `storeCreditTemplateData`: for
  `draft_invoice` it reads the draft's `store_credit` payment row and returns
  `storeCredit.appliedLabel` ("−₹X") and `toPayLabel` (total − credit). Wired into
  `deliverNotification` and the "Review email" preview (`preview.ts`).
- `TemplateData.storeCredit` (packages/notifications): rows "Store credit" and "To pay" under the
  total (`ItemsPanel` `afterTotal`, and the text part); the intro adds "Your store credit covers
  part of it, so ₹Y is left to pay"; WhatsApp says "After your store credit, ₹Y to pay".

## 2. Optional expiry per credit (migration 0239)

- `store_credit_entry` gains `expires_at` (credit lines only, check constraint), `expired_entry_id`
  (on an `expiry` line, unique) and `gift_card_id` (see 4, unique). New ledger kind `expiry`.
- **No mutable "lots" table.** `openLots` (`customers/store-credit-expiry.ts`) replays the
  customer's ledger in id order (uuidv7 = write order): debits take from the credit expiring
  soonest, never-expiring credit last; an `expiry` line empties the credit it names. The ledger
  stays append-only and the one record.
- **When expiry happens (the safer of the two options, both used):** every balance change
  (`changeStoreCredit`, checkout's `spendStoreCreditOnOrder`, a draft convert) first writes due
  `expiry` lines under the account's `FOR UPDATE` lock, so expired money can never be spent — not
  even in the gap before a job runs. Readers (`storeCreditOf`, `shopperStoreCredit`, the checkout
  offer, draft save) use `spendableStoreCredit` = balance − due-but-unwritten. A worker sweep
  (`store-credit-expiry`, hourly, `apps/worker/src/store-credit-expiry.ts`) writes the lines for
  accounts nobody touches so the history shows them; it lists stores through the SECURITY DEFINER
  `stores_with_store_credit_expiring(now)` (looks back 30 days; older ones are written at the next
  change). Read-time alone would leave the stored balance wrong; a job alone would leave a window
  where expired credit could be spent.
- A date means "last day it can be spent": `storeCreditExpiryAt(day, tz)` is the next midnight in
  the store's time zone. Views return `expiresOn` (`YYYY-MM-DD`).
- API `storeCredit.adjust` takes `expiresOn` (only on a credit, must be in the future). Admin Add
  dialog: optional **Expiry date** (DateField). History lines show "Can be spent until …" and kind
  "Expired". Shopper account: "Expired", "· use by …". Refunds, returns and releases: see below.

## 3. Balance line in emails only when it changes

- `storeCreditTemplateData` returns `storeCredit.change` only for `order_placed` (ledger
  `payment` lines on that order: "Store credit used ₹X · balance ₹Y"), `refund_issued` (a refund
  with method `store_credit` onto the balance) and `return_refunded` (a return settled as store
  credit): "₹X added to your store credit · balance ₹Y". Balance = spendable balance at send time.
  Every other template gets nothing. Rendered as a paragraph under the intro (email html + text).

## 4. Old store-credit gift cards → balance

- How they are recognised: refund cards this store made before #1286 have notes starting "Store
  credit refund for order #" / "Store credit for return " (ticked); Shopify-imported cards have
  `created_by = 'Shopify import'` and Shopify does not mark which were store credit, so they are
  listed unticked unless their note mentions store credit or a refund — staff tick them. Only live
  `manual` INR cards with a balance; never bought (`purchase`) cards.
- `customers/store-credit-gift-cards.ts`: `storeCreditGiftCards` (list), `moveGiftCardToStoreCredit`
  (card row `FOR UPDATE`; already moved → `already_moved`; holder = card customer, else customer by
  the card's email, else a new customer for it; no customer → skipped, card untouched; credit
  first, then card debited to 0 with a history line and disabled; the card's `expires_on` carries
  over as the credit's expiry), `moveGiftCardsToStoreCredit` (each in a savepoint).
  `store_credit_entry.gift_card_id` is unique, so even a race can only credit once.
- API `storeCredit.listGiftCards` (customers.read), `storeCredit.moveGiftCards` (customers.write,
  `SENSITIVE_PATHS`: waits for approval through MCP/API). The store activity log records the call.
- Admin: **Products → Gift cards** shows "Gift cards that were store credit" (hidden when none):
  ticks, totals in the confirm, "Move N cards to balance". Copy `data/store-credit-gift-cards.ts` +
  Hindi overlay.

## Tests

- core `customers/store-credit-expiry.test.ts` (replay FIFO, last-day maths, refusals, expiry
  under lock, read-time balance, sweep once, checkout never spends expired, a refund with no date never expires),
  `customers/store-credit-gift-cards.test.ts` (listing/ticks, move, run twice, two at once, holder
  by email/new, no holder, expiry kept), `notifications/store-credit-data.test.ts`.
- notifications `test/store-credit.test.ts` (invoice rows, used/added lines, none otherwise).
- Run here: those plus every core store-credit, draft, returns, order edit, gift card and
  notification test (13 files, 120 tests), api MCP catalogue/approvals, worker, notifications,
  `bun run test:sweeps` (29/29; `openLots`, `dueLots`, `moveGiftCardToStoreCredit` allow-listed in
  no-orphans as tested helpers), typecheck of db, core, notifications, api, worker, admin and
  storefront, Biome on changed files.

## Owner's answers, 12 Nov (same PR)

1. **Refunds and returns to store credit get the optional expiry.** `orders.refund` takes
   `storeCreditExpiresOn` (day or null), `returns.storeCredit` takes `expiresOn`; the Refund
   dialog and the return's Store credit step show `StoreCreditExpiryField` (empty = never).
2. **Spent credit coming back: staff choose again, pre-filled with the original.**
   - `customers/store-credit-return.ts`: `spentStoreCreditParts` replays the ledger
     (`openLots` now reports each debit's parts through `onSpend`) to find what the order's
     store credit payment was spent from; `storeCreditReturnDefault` gives the pre-fill (the
     latest last day, or null when any part never expires), API `storeCredit.getOrderExpiry`
     (orders.read), admin hook `useStoreCreditReturn` (a past date is pre-filled as today).
   - Cancel dialog: "₹X of store credit this order was paid with goes back" + the pre-filled
     field → `orders.cancel` `returnedCreditExpiresOn` → `cancelOrder` → `releaseHeldStoreCredit`
     and `returnGiftCardPayments`; `refundOrderAmount` passes it for `store_credit` payments.
     Refund dialog on a store credit payment: pre-filled the same way.
   - Semantics everywhere: a day = that expiry; null = never; **left out (no dialog: the unpaid
     order expiry, an order edit refund) = each part keeps its original date**
     (`spentStoreCreditReturn` → `splitReturn`: never-expiring parts first, then latest date,
     skipping what went back before). `changeStoreCredit` takes `restoresSpent` so an original
     date that already passed is allowed: that part expires straight away.
3. Moved gift cards keep the card's expiry (unchanged).
- Tests: `customers/store-credit-return.test.ts` (split, pre-fill, unpaid cancel keeps dates,
  staff date / never on cancel, store credit payment refunds part by part and with a choice,
  gateway money to credit with and without a date, an already-passed date expires at once).

## Not done / open

- Browser check owed: the Add dialog, gift cards page card, account page and the emails were not
  opened (no dev server here).
