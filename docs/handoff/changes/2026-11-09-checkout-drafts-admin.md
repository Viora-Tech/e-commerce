# Checkout drafts, part 4: admin

- **Drafts page** (`orders/drafts`): the view picker gains "From checkout (unpaid)" and "Created
  by staff" (`DRAFT_LIST_FILTERS`; `draftViewInput` in `lib/draft-list-filters.ts` turns the view
  into the API's `source` / `status`). New "Unpaid checkouts" tile (`draftTiles().checkout`). The
  list is newest activity first; the date column is "Last activity". A checkout draft's status
  chip: Unpaid, Payment failed ×n, Refund needed, Expired. "Send invoice" is hidden for them.
- **Checkout draft page** (`components/drafts/checkout-draft-view.tsx`, used by
  `orders/drafts/[id]` when `draftSource = 'checkout'`): items and total, payment attempts with
  their errors, the system timeline (checked out again, expired, late payment), contact, method,
  last activity and hold. Actions: Copy payment link (signed thank-you link, `getDraft.payLink`),
  Convert to order (unpaid), Mark as paid (open transfers: `collectPayment` → converts), Delete.
  `saveDraft` refuses to edit a checkout draft.
- **API**: `orders.listDrafts` takes `source`; `orders.getDraft` returns `attempts`, `timeline`
  and `payLink`; `orders.convertDraft` does not write a second `order.placed` for a checkout
  draft. Orders' "Pending UPI" tile also counts open UPI / bank transfer checkout drafts. The AI
  / MCP `pendingOrders` answer adds "Unpaid checkouts (drafts)". MCP action docs regenerated (no
  change: router JSDoc first sentences are the same).
- **Settings → Payments → Advanced → Repeated checkouts**: switch "Keep unpaid checkouts as
  drafts" (`store.payments.unpaidAsDrafts`). `UNPAID_AS_DRAFTS_DEFAULT` there mirrors core
  `CHECKOUT_DRAFTS_DEFAULT`.
- Hindi for every new string (`data/hi/drafts.ts`, `data/hi/payments.ts`).
