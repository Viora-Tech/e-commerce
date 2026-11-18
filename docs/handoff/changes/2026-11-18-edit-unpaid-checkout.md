# Edit an unpaid checkout draft

Branch `feat/edit-unpaid-checkout`. No migration (`order.draft_source` already allows `staff`).

Owner: "if it's unpaid it is a draft, we should be able to edit it". An unpaid checkout draft
(Orders → Drafts, "Unpaid checkout") now has an **Edit** button. Staff take it over and it becomes
an ordinary staff draft in the draft form (same row, id and #D number).

- **Admin:** `components/drafts/checkout-draft-edit-button.tsx` (Edit + confirm popup: the
  shopper's current link stops and they need the new one), shown on `checkout-draft-view.tsx`
  unless money is in (an authorised, captured or refunded try, or refund needed). After the
  take-over the page refreshes and `orders/drafts/[id]/page.tsx` renders `DraftForm`, because
  `draftSource` is now `staff`. From there it is a normal draft: Send invoice (the signed invoice
  link with the new total), Convert to order, Reserve items. Refusals come back with
  `data.reason`, read by `checkout-draft-take-over.ts` (tested), in the member's language. Copy:
  `data/checkout-draft-edit.ts` + `data/hi/checkout-draft-edit.ts`.
- **API:** `orders.takeOverCheckoutDraft` `{ id }` (`routers/order-drafts.ts`, `DRAFTS_WRITE`),
  service `services/draft-take-over.service.ts` (resolves the store's gateways). Refusal: 409
  (404 for not found) with `data.reason`. `saveDraft` on a checkout draft now says to use Edit
  first. MCP action doc added.
- **Core:** `order/checkout-draft-take-over.ts` → `takeOverCheckoutDraft`. Under the order row
  lock it refuses (`CheckoutDraftNotTakeable`, nothing changed) when: not a checkout draft any
  more (`not_checkout`); a try is captured or refunded (`paid`) or authorised (`in_progress`); the
  shopper said "I've paid" on a transfer (`shopper_paid`); gift card or store credit is held
  (`split_tender`). Then it asks the gateway about every try it answered, as the unpaid expiry
  does (`fetchStatus`, failed and cancelled tries too: a Razorpay order stays payable after a
  failed try): captured or authorised there → `in_progress`; gateway off, keys gone or down →
  `unchecked`. Otherwise: every try that never kept money (created, pending, failed, cancelled)
  is set `cancelled` with the error `Stopped: staff took over the checkout to edit it` (any old
  error kept in brackets); the checkout's discount uses are given back (staff convert counts the
  code again); `draft_source = 'staff'`, `draft_expired_at = null`; a payment-method discount with
  no code beside it becomes the draft's manual discount, a fee (or a method discount beside a code)
  comes off the total with a system note (staff drafts have no payment-method adjustment); the
  timeline line `<staff email> took over unpaid checkout to edit; old payment link stopped`.
  Contact, addresses, lines, discount, shipping, held stock and `attribution` stay.
- **Late payment on the old link:** Razorpay has no "cancel order" API, so a gateway order the
  shopper still has open can still be paid. `payments/confirm.ts` `applyPaymentStatus` now flags a
  capture or authorisation refund needed (and notes `TAKEN_OVER_PAYMENT_NOTE`) when the try carries
  the take-over mark, or lands on a staff draft. It never marks the draft or the converted order
  paid and never converts it.
- **Storefront, the old link:** the signed order page (`thank-you.tsx`) shows "The shop is updating
  this order" / "This payment link no longer works…" for a draft that is not a checkout draft,
  with no pay, retry or transfer buttons. `retryPayment` and Pay online instead already refuse it
  (not an open order or checkout draft); payment-pending and transfer nudges stop for the same
  reason.
- **Tests:** `packages/core/src/order/checkout-draft-take-over.test.ts` (DB: take-over keeps the
  shopper data and stops the tries, each refusal, late capture before and after convert, the fee
  fold), `apps/admin/src/components/drafts/checkout-draft-take-over.test.ts`. Not run here (low
  memory PC, no node_modules in the worktree): run them on dev.
- **Owed:** browser check on localhost: Edit on an online and a transfer checkout draft, the
  refusal toasts, the draft form after it, the old link's page. The staff draft form has no
  timeline card, so the take-over line shows on the order's timeline once it converts.
