# Compact courier list at checkout (20 Nov 2026)

Owner, while testing Delivery options with all couriers shown: the list was too tall.

- `apps/storefront/src/components/checkout/courier-list.tsx` (new): one compact row per courier
  in a single box (logo, name, date, price). First row tagged Cheapest; the cheapest of the rows
  arriving on the earliest day tagged Fastest. Three rows until "Show N more couriers".
- Cash on delivery is said once above the rows ("on every courier"), not on each card.
- A courier at the same price as the first shows that price (owner: no "Same price" text;
  dearer couriers show "+ ₹X").
- The order summary names just the courier ("Blue Dart Air") in courier-list mode, not
  "Standard · Blue Dart Air".

Checked, not changed:
- RapidShyp's Air services come back with later dates than Surface (Blue Dart Air Sat 28 Nov vs
  Surface Mon 23 Nov for 131001). That is RapidShyp's own date; "Hide couriers that are slower
  and dearer" removes them.
- Unticking insurance can leave a card's price the same: Delhivery's insurance (₹2.82 on ₹399)
  vanishes in the round-up to the next ₹10.
