# Checkout falls through shipping zones that have no rate

`quoteShipping` used only the single most specific zone for an address. On Waimers, the Shopify import left two zones ("All India" and "in") that list every state but hold no rates; a zone that names the state outranks the "everywhere" zone, so every address got the empty zone and checkout said "We do not ship to <PIN> yet" for every product and PIN (found 2026-10-21 by a guest checkout on the live store and a read-only look at the zones).

Now the covering zones are tried from most to least specific, and the first with a rate for the cart wins. The order transaction (`place-order.ts`) uses the same function, so preview and placing agree. `pickZone` is unchanged.

Waimers still has the two empty zones; the merchant can delete them under Settings → Shipping → Shipping zones.
