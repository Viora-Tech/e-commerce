# Store credit balance, step 1 of 5

A real per-customer store credit balance instead of a gift card code. This is step 1 of the plan,
plus Collect payment and refunds to store credit.

Open-source radar check: `docs/open-source-radar.md` says gift cards and loyalty-type features
are built in-house on our own tables, with Medusa (MIT) as a pattern reference only. A ledger
plus a balance is small and has to sit inside our order, refund and RLS rules, so it is built
in-house. Nothing was copied, so there is no `THIRD_PARTY_NOTICES.md` entry.

- **Tables** (`packages/db/src/store-credit-schema.ts`, migration `0227_store_credit.sql`, RLS
  via `apply_store_rls()`; written by hand because the Drizzle snapshots stop at 0210):
  `store_credit_account` (one row per customer, `balance_paise >= 0`) and `store_credit_entry`
  (signed `amount_paise`, `balance_after_paise`, `kind` adjustment/payment/refund, `reason`,
  `staff_user_id` + `staff_email`, `order_id`).
- **Core** (`packages/core/src/customers/store-credit.ts`): `storeCreditOf`, `changeStoreCredit`
  (locks the account row; a debit over the balance throws `insufficient` and changes nothing),
  `payOrderWithStoreCredit`, `refundToStoreCredit`.
- **API**: `storeCredit.get` (customers.read) and `storeCredit.adjust` (customers.write). MCP
  area `customers`. `storeCredit.adjust` is in `SENSITIVE_PATHS`, so through MCP or the API it
  always waits for approval. `orders.collectPayment` was already sensitive.
- **Customer page**: a Store credit card with the balance, the history (who, why, when) and an
  Add / Remove dialog (amount and reason).
- **Collect payment**: a "Store credit" method (`MANUAL_PAYMENT_METHODS`). The dialog shows the
  customer's balance and blocks when it is too low or the order has no customer. The API debits
  the balance in the same transaction, so a short balance rolls the whole collection back.
- **Refund to store credit** (order refunds, and refunds from staff cancel and edit): the money
  goes onto the customer's balance (refund row `method = store_credit`, no gift card). An order
  with no customer still gets a gift card, as before. The refund email says "your store credit
  balance".

Not in this PR (later steps): checkout redemption; the returns flow's "Store credit" resolution
(still a gift card); Shopify store credit import; moving existing customer gift cards into the
balance (SHRIRAM V's ₹1,900 card ending G49E); paying order #2424 from it.

Also: `gstInvoicesProducts: 'products'` in `mcp/action-areas.ts`. It has been missing since #1242
and made `mcp-action-catalogue.test.ts` fail on dev.
