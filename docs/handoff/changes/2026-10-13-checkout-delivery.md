# Checkout shipping step: option cards with arrival dates

**Branch** `feat/checkout-delivery` (stacked on `feat/checkout-contact-address`), **no
migration**. Third of three stacked checkout branches.

## What shoppers see

- The Shipping step shows the store's shipping rates for the address as **option cards**: the
  rate's name, its price on the right ("Free" in green), and the **date it arrives**: "Arrives
  tomorrow, Sun, 11 Oct", "Arrives Wed, 14 Oct", or a range "Arrives Wed, 14 Oct - Fri, 16 Oct"
  (green on the picked card). When the options do not all arrive together, the first to arrive
  is marked **Fastest** (bolt icon when it costs extra). Free shipping (no rates set up) is one
  card with its own arrival date.
- The Payment step's recap uses the same line ("Express · ₹149 · Arrives tomorrow, Sun, 11 Oct").

## Where the dates come from (`apps/storefront/src/lib/rate-dates.ts`)

- **Courier first**: when the store's courier answered for this PIN code (not a fallback), its
  window dates the store's standard (cheapest) option and any option without transit days of its
  own. The courier's serviceability answer describes its standard service, so it is the truth for
  that option even when the merchant typed days on it.
- **Then the option's own days**: an option with min/max transit days (Express, 1-2 days) keeps
  its promise, counted with the store's dispatch calendar (cutoff, working days, delivery days,
  holidays) through `computeDeliveryEstimate`, as before.
- **Then the store's default days** when the courier did not answer and the option has none.
- "Today" and "tomorrow" are counted in the store's time zone (`zonedNow`), so a late-evening
  order in India is not a day off.
- `placeOrder` and the parcels' stored windows (`checkoutParcels`) are unchanged.

## Code notes

- `CheckoutRate` gained `arrives` (the card's line) and `fastest`; `CheckoutShipping` gained
  `arrives` (free shipping's line). `dateRange` stays for the parcels and older readers.
- Tests: `lib/rate-dates.test.ts` (sources, today/tomorrow across the IST date line, ranges,
  fastest) and `components/checkout/delivery-method.test.ts` (cards, Fastest, free card, the
  unserviceable alert, the waiting state).
- `no-orphans` allow-list: `addCalendarDays` and `zonedNow` (`@commerce/shipping`) have an
  importer now and left the list.
- Not done: the Figma frame's "Choose a delivery day" option needs a scheduled-delivery rate type
  the store does not have yet.
