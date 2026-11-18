# Draft orders: store credit taken as the balance is at convert, never refused

Store credit on admin draft orders already shipped in #1558 (store credit step 3, 11 Nov; see
`2026-11-11-store-credit-finish.md`): the Store credit card on the draft, "Apply store credit" up
to min(balance, total), Change / Remove, the Store credit and To pay lines in the Payment card,
nothing taken while it is a draft, and one ledger debit linked to the order when it converts
(staff convert, or held when the customer pays the invoice online). This change alters one rule
from that work.

**Before:** if the customer's balance fell below the applied amount after the draft was saved
(spent at checkout, staff removed some), the convert was refused, and the admin disabled
Convert with "Store credit is more than the customer's balance. Lower it."

**Now:** the convert takes what the balance holds at that moment, capped at the applied
amount, and the chosen payment method (or the invoice's gateway) collects the rest. An empty
balance takes nothing: no ledger line, and the draft's `created` store credit row is deleted.

- **Core** `order/draft-store-credit.ts`:
  - `spendDraftStoreCredit`: under the account row lock, `take = min(applied, balance)`; debits
    `take` (ledger `payment`, "Used on order #N", linked to the order) and sets the payment row's
    `amountPaise` to `take`. `convertDraft` already uses the returned amount for the rest.
  - `setDraftStoreCredit`: saving the same amount for the same customer again (an unrelated edit
    after the balance fell) is kept, not refused; a new amount is still checked against the
    balance.
  - New `draftStoreCreditDue(ctx, orderId)`: what a convert would take now (applied, capped at
    the spendable balance).
- **Online invoice** `order/draft-pay.ts`: the "store credit pays all of it" check uses
  `draftStoreCreditDue`; the gateway attempt asks for the convert's own rest row, not a figure
  read before the lock. `loadDraftInvoice` shows the capped credit while it is still a draft.
- **Invoice email** `notifications/store-credit-data.ts` and **bulk Send invoices**
  (`draftEmail` in `api/services/draft.service.ts`, now takes `storeId`): use the capped credit.
- **Admin**: `draftStoreCreditUsable(applied, balance)` in `draft-form-state.ts`; the
  `over_balance` problem is gone, so Convert stays on. The Store credit card says "The balance is
  now ₹X, so only ₹X will be used..." (`capped` copy, English + Hindi), and the Payment card's
  Store credit / To pay lines and the Send invoice switch use the capped amount
  (`DraftTotalsCard` takes `creditBalancePaise`).
- **Docs**: merchant guide Drafts → "Paying with store credit", the balance-went-down bullet.
- **Tests**: core `order/draft-store-credit.test.ts`: balance fell (partial take, manual
  collects the rest), balance emptied (no debit, no row), unchanged amount kept on edit, two
  drafts converting at once now share the balance (60 000 + 40 000, two debits), online invoice
  with a fallen balance (attempt for the larger rest). Admin `draft-form-state.test.ts`:
  `draftStoreCreditUsable`, problem cases without `over_balance`. Not run here (owner's
  workflow: tests run on dev).

Debit once, unchanged: the convert locks the draft row (`FOR UPDATE`), so a second convert
waits and then finds an order; the debit and the payment row flip happen in the convert's
transaction, and the flip only matches a `created` row. Delete or Remove leaves the balance
alone (nothing was taken). No migration.

Not checked in a browser (no dev server on this machine).
