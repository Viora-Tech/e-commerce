# Checkout: "Share this order with our advertising partners" (optional, unticked)

Roadmap item agreed 6 Nov. A shopper who never answered the cookie banner (or said no) left an
order whose server Purchase (Meta Conversions API) was skipped as `no_consent`. Checkout now
offers one optional tick under Contact, beside the email and WhatsApp ones: "Share this order
with our advertising partners to improve the ads you see".

- **When it shows** (`orderSharingOffered`, `pixels/collect.ts`): the Pixels app is installed and
  an active pixel has a Conversions API token and sends Purchase; and the banner does not already
  hold the shopper's yes to marketing (checked on the checkout page from the consent cookie).
- **Never blocks checkout.** It is unticked by default, never required, and only a tick the
  shopper could see is sent (`use-checkout-form`: `shareOrder: input.orderSharing && form.shareOrder`).
- **Recorded with the order** as `tracking.orderSharing = { at, source: 'checkout' }` on the cart
  (`syncCartMarketingConsent` → `syncOrderSharing`), which the order copies. With the tick, this
  request's `_fbp` / `_fbc`, IP and user agent are kept too, for matching. Unticked on a later
  submit removes an earlier tick, so the banner alone decides again.
- **Purchase**: `maySendOrderPurchase(tracking)` (`pixels/client.ts`) = banner marketing yes, or
  the tick. `purchaseSkipReason` and the order send (`send.ts`) use it. `hasMarketingConsent`
  is unchanged and still means the banner yes; the browser pixel and storefront events still need
  it. Unticked keeps today's behaviour exactly.
- **Wording**: `apps/storefront/src/data/checkout.ts` `marketing.shareOrder`. The storefront has no
  Hindi overlay of its own; Hindi shoppers get Settings → Checkout → Checkout content, where the
  line is now rewordable per language (`CHECKOUT_TEXT_KEYS` `marketing.shareOrder`, listed under
  Contact; admin labels in `data/checkout-rules.ts` and Hindi in `data/hi/checkout-rules.ts`).
- `PixelTracking` (jsonb on cart and order) gains the optional `orderSharing`; no migration.

Tests: `pixels/client.test.ts` (the tick passes the Purchase gate, is not a banner yes),
`pixels/storefront-events.test.ts` (tick recorded with browser details and Purchase not skipped;
unticked later removes it; offered only with the app and an active CAPI pixel sending Purchase).

For the owner: the privacy policy may want a line saying orders are shared with advertising
partners when the shopper ticks this box.
