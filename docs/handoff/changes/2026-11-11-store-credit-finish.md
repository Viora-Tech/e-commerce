# Store credit step 3: draft orders paid with store credit (#1558)

What the five-step plan was (owner chat, 7–8 Nov): 1 balance, history, staff Add/Remove, refunds
(#1286); 2 checkout (#1307); 3 **admin orders: use the customer's balance on an order you build
for them**; 4 Shopify import (#1334; called "step 5" in the 7 Nov scope note). "Later, if you want
it": expiry dates and the balance in emails. Step 3 was the one missing; this adds it.

- **Core** `packages/core/src/order/draft-store-credit.ts`:
  - `setDraftStoreCredit` (from `createDraft` / `updateDraft`, input `storeCreditPaise`): records
    the applied amount as a `store_credit` payment row in status `created` (customer in
    `provider_payment_id`, ref `store_credit_draft_<id>`). Checks: a customer is picked, at most
    the draft total, at most the balance now. Nothing leaves the balance. Left out on an edit, the
    draft keeps its amount and it is checked again (customer, total, balance).
  - `spendDraftStoreCredit` (from `convertDraft`, after the order number is taken): locks the
    account row, writes the ledger `payment` line ("Used on order #N") and flips the same row to
    `captured`, or `pending` with `holdStoreCredit` (the invoice page). A balance below the amount
    refuses the convert; the whole transaction rolls back.
  - Convert: the method's `pending` row is for total − credit only; when credit covers everything
    there is no such row, `payment_method = store_credit`, no due date, the order reads paid.
  - Delete: the `created` row goes with the draft's other unfinished payments (already so), so
    deleting never touches the balance. The convert's `FOR UPDATE` on the draft row stops a second
    convert from taking the credit twice.
- **Invoice paid online** (`convertDraftForOnlinePayment`): the credit is held (`pending`), the
  gateway attempt asks for the rest; capture and the unpaid-cancel release are the existing
  `captureHeldStoreCredit` / `releaseHeldStoreCredit`. Credit covering it all throws
  `DraftPaidByStoreCredit`; `orders.sendInvoice` refuses it and bulk Send invoices skips it.
  `loadDraftInvoice` returns `storeCreditPaise` and `duePaise`; the storefront invoice page shows
  "Store credit −₹Y" and "To pay", and Pay asks for the rest. Invoice copy moved to
  `apps/storefront/src/data/checkout-invoice.ts` (checkout.ts was over 500 lines).
- No migration: the applied amount lives on the payment row, so nothing races 0238.
- `DraftListItem` moved to `draft-list.ts` (drafts.ts stays under 500 lines).
- **API**: `orders.getDraft` returns `storeCreditPaise`; `orders.saveDraft` takes it.
- **Admin**: `DraftStoreCreditCard` (side column, needs customers.read): balance, Apply store
  credit dialog (up to min(balance, total), "Use ₹X"), Change / Remove. The Payment card shows
  Store credit and To pay. Picking another customer clears it (`patchDraft`). Convert says why
  when the credit cannot stand (`draftStoreCreditProblem`); Send invoice is off when credit pays
  it all. Copy `data/draft-store-credit.ts` + Hindi overlay.
- **Docs**: merchant guide Drafts → "Paying with store credit", Customers → Store credit link.
- **Tests**: core `order/draft-store-credit.test.ts` (apply, refusals, full and part cover with
  GST unchanged, balance spent since save, two drafts converting at once, same draft twice,
  delete, invoice hold + cancel release, full cover has nothing to pay online); admin
  `draft-form-state.test.ts` store credit cases.

Not done (reported): the draft invoice email still says "order for ₹total" without the credit;
store credit expiry and the balance in emails (owner's "later"); no tool to move other customers'
old gift cards into balances. Browser check owed (no dev server here).
