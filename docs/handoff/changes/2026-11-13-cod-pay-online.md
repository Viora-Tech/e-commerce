# Ask a COD shopper to pay online (13 Nov 2026)

Owner decision: staff can ask a cash on delivery shopper to pay online, e.g. when no courier takes
COD to their PIN. Before, "Ask to pay online" in the bulk ship drawer only flipped the row to
Prepaid locally and nothing reached the shopper.

## What changed

- **Migration `0246_cod_pay_online`**: nullable `order.pay_online_requested_at` and
  `order.pay_online_reminded_at` (timestamptz; the order table's store RLS covers them) and the
  SECURITY DEFINER `stores_with_pay_online_requests()` for the worker sweep.
- **`payOnlineInstead`** (`packages/core/src/payments/pay-online-instead.ts`) now also takes an
  unpaid open COD order: the open `cod` attempt is cancelled (if any) and a gateway attempt opens
  for what is still due (total less anything captured; a COD fee stays). No discount logic. Refused
  once anything is packed. Timeline: "The customer chose to pay online with Razorpay instead of
  cash on delivery." The order keeps `payment_method = 'cod'` until paid, so the unpaid expiry
  never cancels it.
- **Capture makes it prepaid** (`order/recompute.ts`, `codPaidOnline`): when the call that sets
  `checkout_paid_at` sees a gateway capture on a COD order, `payment_method` becomes the gateway,
  a timeline note says it now ships prepaid, and a waiting COD confirmation (COD & RTO app) is
  answered (`confirmed`, `cod-unconfirmed` tag removed). Shipping, the bulk drawer and order push
  already read `payment_method`.
- **Staff cash stays cash**: "Mark as paid" and "Collect payment" on a COD order only capture a
  `cod` attempt (else record a `cod` / chosen-method row), never the open "pay online" gateway
  attempt; a late gateway capture is then flagged refund-needed by the one-capture rule. An edit of
  an unpaid COD order cancels the stale gateway attempt (the next tap opens one for the new total).
- **`orders.requestOnlinePayment({ orderId, custom? })`** (Orders: edit): refuses paid, cancelled,
  draft, imported, non-COD, packed orders, orders without email/phone, and stores with no online
  method. Stamps `pay_online_requested_at`, notes it, queues `order.pay_online_requested` →
  `cod_pay_online` (manual message, email + WhatsApp once Meta approves a template of that name;
  WhatsApp params = payment_pending's). Core: `payments/cod-pay-online.ts`.
- **Reminder**: the worker's payments tick (`apps/worker/src/payments-expiry.ts`) sends one
  reminder two days after the request if still unpaid (`runPayOnlineReminders`), stamping
  `pay_online_reminded_at`. Nothing is cancelled. The COD confirmation sweep no longer
  auto-cancels an order staff asked to pay online (it still flags it).
- **Storefront order page**: an unpaid COD order with `pay_online_requested_at` shows a "Pay online
  to get your order shipped" block (same form as the transfer one, runs `payOnlineAction`), and
  drops the "pay in cash" line.
- **Admin**: the bulk drawer's "Ask to pay online" calls the procedure, toasts "Payment link sent to
  <name>" and the row then shows "Waiting for online payment" (`shipments.prepare` carries
  `payOnlineRequestedAt`). The order page's More actions has "Ask to pay online" for unpaid,
  unpacked COD orders, through the Review email dialog. Copy + Hindi in data/.

## Open

- WhatsApp needs a Meta-approved `cod_pay_online` template (params: name, store, order number,
  total, link).
- An order already pushed to a courier panel as COD (order push) is not re-pushed as prepaid.
