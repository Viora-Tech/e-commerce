# Create shipment: Ship from › Edit opens the pickup address

**What:** On Create shipment, Ship from › Edit now goes to
`/settings/shipping?open=dispatch&focus=address` (`routes.settings.shippingAddress()`): When orders
go out opens with More options already open and the ship-from address fields scrolled into view
(`ShippingPolicyFields` `focusAddress`, read from `?focus=address` with nuqs in `shipping-page.tsx`).

**Why:** Owner, 23 Nov: Edit "doesn't work". It opened When orders go out with More options
closed, so only the PIN code showed and the address on the card was nowhere to be seen.
(Change works: it opens the Pick up from dialog; Waimers has one pickup place, so it only offers
"Add a pickup location".)

**Tests:** admin typecheck clean; Biome clean.
