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

## Want a different courier? (same day)

- An optional box under the courier list: "Want a different courier? (optional)", "We'll call
  you with the price before we ship." Sent with Pay as `courierRequest` (max 80 characters).
- `packages/core/src/order/courier-request.ts`: the order gets the `courier-request` tag and a
  system note "Shopper asked for another courier: X. Call them with the price before you ship."
  Once per order (checking out again on the same draft does not repeat the note).

## Cash on delivery keeps the picked courier (same day)

Bug: in courier-list mode, paying on delivery ignored the card the shopper picked. The order
shipped and was charged on the option's cheapest COD route (Payment step: "Cash on delivery:
+₹40, ships with Amazon Shipping" while Delhivery Express was picked).

- `courier-list.ts`: each card carries `codPricePaise` (its price plus its own COD charge, rounded
  up to ₹10; free shipping stays free; null when the courier takes no COD).
- `resolve.ts` `chosenRoute`: on COD in list mode, the picked card (or the first) at its COD
  price; the option's COD pick only when that courier takes no COD.
- `checkout.ts`: the snapshot keeps each card's COD price, and the order checks it by the card.
- Storefront: the Payment step says "Cash on delivery: +₹X" (no other courier named).

## Preferred courier and "Round delivery prices" (same day)

Owner's cases: mice by Delhivery Air, so no Delhivery Surface card, but Blue Dart Surface / Air
and Amazon still offered; a courier cheaper than the preferred one costs the same (free when
it is free), a dearer one adds the difference.

- `courier-list.ts`: when the pick is a rule's preferred courier (`why.kind === 'rule_default'`),
  that courier's other speeds are left out. Prices were already "pick + max(0, difference)".
- Checkout tags the first card "Recommended" (not "Cheapest") when it is a rule's preferred one.
- `rounding.ts` + `price.rounding` (`nine` ₹43→₹49, `fifty` ₹58→₹99, `ten` ₹43→₹50, `off`):
  engine prices, insurance on Free, and list extras. Default `ten`, so saved options keep their
  prices; the Options page's "Round extras up to ₹…9" switch is now a "Round delivery prices"
  dropdown (EN + HI). On `ten`, extras still follow the old switch.
- Tests: `preferred-courier.test.ts` (the owner's mouse sample).
- Not done: the fixed-options form (Standard / Express cards) has no rounding dropdown yet.
