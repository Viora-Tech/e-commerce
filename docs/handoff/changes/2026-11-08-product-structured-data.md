# Product structured data: merchant-listing fields Google asks for

Search Console flagged the product JSON-LD on www.waimers.in. The live page (checked
read-only, the glass mousepad) had a Product with Offer, rating and review, but each Offer was
missing `shippingDetails`, `hasMerchantReturnPolicy` and `priceValidUntil`, and its `seller` was
only an `@id` pointing at the Organization node that lives on the home page, not this one.

- `apps/storefront/src/lib/seo.ts` `productGraph`: every Offer now carries
  - `seller` as a full Organization (`@id` and `name`);
  - `priceValidUntil` one year out (prices stand until the merchant changes them);
  - `shippingDetails` (India): free when the store has no India rates or the price clears a
    free-shipping threshold, else the cheapest flat India rate; delivery days from the rates'
    transit days. Left out when the store's India rates all depend on weight or order value;
  - `hasMerchantReturnPolicy` from Settings → Returns: the window in days, by mail, or
    `MerchantReturnNotPermitted` when returns are off.
  India shipping and returns are only added to INR prices (not markets abroad).
- `packages/core/src/seo/offer-policies.ts` `productOfferPolicies` (new subpath
  `@commerce/core/offer-policies`) reads those facts once; the product page caches it per store.
- Unchanged and already valid: name, image, description, brand (vendor, else the store), sku,
  AggregateOffer for several variants, AggregateRating, Review, BreadcrumbList.
- Tests: `seo.test.ts` (+2), `offer-policies.test.ts`.
