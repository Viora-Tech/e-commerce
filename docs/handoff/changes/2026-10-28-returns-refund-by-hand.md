# Returns: refund by hand, and a credit note for store credit (#879)

## Paid back by hand

Orders → Returns → Refund used to send the money back only through the gateway. An imported
or cash on delivery order had no gateway to refund through, and a merchant who paid a
customer over UPI had no way to record it against the return.

The refund step now asks how the money goes back:
- **Back the way they paid** works as before.
- **Paid back by hand** takes a method (UPI, bank transfer, cash, cheque, other) and is only
  recorded, the same way as the order page's refund dialog.

Orders with no gateway payment (`cod`, `manual`, `shopify`) only offer the by-hand option.
- Core: `refundReturn` takes `method`, and `refundPayment` records the refund with `manual`.
- API: `returns.refund` takes an optional `method`, which can be any refund method except
  store credit.

## Store credit is a refund, with a GST credit note

`storeCreditReturn` used to issue a gift card and resolve the return without recording a
refund. Two problems followed:
- No `refund.created` event was raised, so the GST invoices plugin issued no credit note. The
  original sale stayed taxed, and spending the card was then billed in full, which taxed the
  same value twice.
- The payment stayed fully refundable, so the same money could also be refunded later.

Now the credit is recorded as refunds of the order's payments (method `store_credit`, status
`manual`, largest payment first). Each refund is tagged with the return through `refund.created`,
so the plugin credits the returned units at their own rate (#873).
- The customer still gets **one** gift card, even when the order had several payments.
  `RefundInput.giftCardId` records the card already issued instead of minting one per payment,
  and a payment made from a gift card keeps its own card balance.
- Store credit can no longer exceed what the order can still refund.

Both resolutions share `payBack` in `packages/core/src/returns/resolve.ts`.

## Docs and tests

- Merchant guide, Returns and RTO: the two refund ways, store credit counting as money back,
  and an FAQ on GST with store credit.
- `packages/core/src/returns/returns.test.ts`: a store-credit return records one refund with
  the gift card and raises `refund.created` for the return. A by-hand refund never asks the
  gateway, and leaves nothing for a second credit.
- `packages/plugin-gst-invoices/test/parcels.test.ts`: a store-credit or UPI refund on a
  return gets a credit note for the returned unit only.
