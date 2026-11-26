# A rule's courier wins on a Standard card (27 Nov 2026)

Owner's choice: "rule's courier wins".

## The bug

Live Waimers (fixed layout, one Standard option priced from zones, Express off). The Mice rule
(collection mice; couriers Delhivery any speed, Amazon Surface, Blue Dart any speed, Ekart
Surface; preferred Delhivery Air; price Free) shipped free but never by Delhivery Air: checkout
showed Amazon Shipping (110001) and Ekart (400001).

Cause: a non-list Standard option only took routes of its own speed (`resolve.ts` candidates
and `dropReason`'s `wrong_speed`), so Delhivery Air was dropped before `pickFor` looked for the
rule's preferred route, and the strategy then picked the cheapest surviving surface courier.
Amazon Surface and Ekart Surface are on the rule's list, so the rule's courier limit itself was
respected; only the preferred route was lost.

## The fix

- `pick.ts`: a route matching the top rule's preferred `defaultRoute` (not forced) is no longer
  dropped for the option's speed or its courier switches (`dropReason(..., ruleRoute)`), so it is
  one of the option's fits and goes first. The rule pool, PIN, price, insurance, COD and max ETA
  checks still apply. When the preferred route cannot reach the PIN, the strategy picks the next
  courier among the option's own routes that the rule allows, still at the rule's price (as
  decided 20 Nov). A forced route is handled as before (#1782).
- `pick.ts` `optionCandidates`: the option's own routes plus any matched rule's preferred or
  forced route, whatever its speed. Used by `resolve.ts` (rule pool, "couriers down" check) and
  `rule-split.ts` (whether a cart needs splitting), so both see the same pool.
- Options without a matching rule with a preferred route behave exactly as before.
- Snapshot, `shownPrices`, `orderDeliveryFor` and booking need no change: they read the engine's
  pick, so the saved route is Delhivery Air and `bookingPlan` finds it (a Standard option's
  booking already accepted any speed).

## Behaviour change to know

A store with Express on and a rule preferring an Express-speed route: Standard now rides that
route, so Express is no faster and hides (`not_faster`), as with a forced route. Waimers has
Express off.

COD on a free rule still charges the courier's COD cost (by design).

## Tests

`packages/core/src/shipping/delivery-options/rule-route-wins.test.ts` (new): the live case (mouse
→ Delhivery Air, ₹0, order saves it, booking finds it, COD keeps it), preferred unreachable →
next allowed courier (DTDC cheaper but not allowed), never a courier outside the rule, no-rule
product unchanged, mouse + glass pad in one parcel (Delhivery Surface, both rules), split cart
glass pad + mouse (Delhivery Surface + Delhivery Air). `rule-price.test.ts`: the "Express keeps
its own price" case now uses a rule with no preferred route, and a new case covers Express
hiding when Standard rides the preferred Air route.
