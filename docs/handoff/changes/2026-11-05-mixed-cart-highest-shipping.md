# Mixed carts pay the highest shipping rate once

A cart with products from several shipping profiles used to pay every profile's rate added together. It now pays the highest of the picked rates, once. This applies to every store.

- `combine` in `packages/core/src/shipping/profiles.ts` takes the highest price instead of the sum. This reverses audit #159's "on top of General" rule, at the merchant's request.
- The order's `shipping.profiles` snapshot still records each profile's own rate, so those no longer add up to `shippingPaise`. Nothing reads them as a total.
- Courier-priced delivery options are not touched: they do not use profile parts.
