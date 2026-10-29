# Delivery options at checkout (design)

Owner, 29 Oct 2026: "We already use those delivery apps for courier, but we can also use them
for checkout showing possible options. We have to create an app which shows: your Delhivery,
Shiprocket, RapidShyp, Bluedart etc. app is connected, use them to show at checkout. I created
something similar for Waimers on Shopify with rules."

Status: design only. No product code yet. Revised the same day with the owner's decisions
(listed at the end, replacing the first draft's open questions).

## What it is
An app, **Delivery options** (`/apps/delivery-options`), that turns the courier apps a store
has already connected into the choices a shopper sees at checkout:

- which options exist for this PIN code (Standard, Express), each backed by the best
  **route** (a courier reached directly or through an aggregator) for that option's strategy,
- each option's arrival date, from the route's own transit time and the store's dispatch
  calendar,
- each option's price: route cost + markup + insurance, rounded up to the next ₹10,
- whether cash on delivery is offered with it (Standard only),
- **product and collection route rules** ("Glasspads ship with Delhivery only", "Mice ship
  Delhivery Express, or Blue Dart Air if the shopper prefers"), and later a general rules list
  like the Shopify apps the owner used.

The exact route behind the shopper's choice is saved on the order, and Create shipment books
that route, so what the merchant pays the courier matches what the shopper was charged for.

Goals:
- More honest dates and fewer failed COD orders: the shopper sees what the courier really
  serves for their PIN.
- An Express option at checkout without the merchant keeping a second price table by hand.
- Fragile or high-value products always travel with the courier that insures them.
- Checkout never waits more than about 1 s on couriers. When couriers are down, checkout still
  works.

Non-goals (v1): same-day and next-day delivery, booking a time slot or delivery date picker,
store pickup (a separate feature), international carrier rates at checkout (DHL Express and FedEx
stay booking-only), splitting one cart into several shipments with separate charges.

Anti-goals: never charge more than the price the shopper saw; never show an option the
merchant cannot book; never let one slow courier blank the Shipping step; never show the
aggregator's name to the shopper.

## Where we are today (dev, `ee02145a6`)

**Checkout.** `apps/storefront/src/lib/shipping.ts` → `checkoutShipping()`:
1. `estimateForPincode` asks **one** courier (the first enabled domestic one,
   `domesticShippingProvider`) whether the PIN is serviceable. The answer is cached in Redis for
   24 h per store, courier and origin>PIN (`serviceabilityKey`, `SERVICEABILITY_TTL_SECONDS`).
   A transport failure falls back to the store's default transit days. A real "no" means the
   shopper sees "we don't deliver here".
2. `quoteCartShipping` prices the cart from the store's **zones and rates** (Settings → Shipping
   → Shipping rates, `packages/core/src/shipping/rates.ts`): the most specific zone (exact PIN >
   PIN prefix > state > everywhere), and the rates in it by order value or weight band, with
   "free above ₹X" and a per-rate COD fee.
3. Each rate gets a date window (`rate-dates.ts`) from its own transit days or the courier's,
   and the card UI (`components/checkout/delivery-method.tsx`) marks the fastest one.

Waimers has one zone with one rate, hence the single "Standard · Free" card
(`packages/db/src/default-shipping.ts` seeds "Standard ₹49, free from ₹999"; the Shopify
import replaced it).

**Order.** `placeOrder` prices the rate again on the server (`place-order.ts`, `shippingRateId`)
and stores `order.shipping_rate_id`, `shipping_rate_name` and an `OrderShippingSnapshot`
(zone, rate, list price, charged price, COD fee, transit days). No courier is recorded.

**Booking.** Create shipment and bulk booking already compare every connected courier
(`compareCourierRates` in `core/shipping/courier-rates.ts`): one row per bookable service
(`RateOption`: `serviceId`, `serviceLabel`, `carrier`, price, transit days, `codAvailable`,
itemised `charges`), with badges (cheapest, fastest, recommended). The store's booking rule
(`courierRule`: cheapest / fastest / preferred / per-state) picks one (`chooseCourier`, used in
`shipments-workspace.service.ts`). The booking passes `serviceId` (Delhivery mode `S`/`E`, Blue
Dart product code, Shiprocket `courier_id`, RapidShyp `courier_code`).

**Insurance today.** The store has "insure above ₹X" (`insuranceThresholdPaise` in
`core/shipping/settings.ts`), and a shipment row stores `insured` and `declaredValuePaise`
(`core/shipping/shipments.ts`). That flag is **ours only**: no adapter sends an insurance
request to the courier, and no adapter declares the `insurance` capability. Quotes show an
insurance line only where the courier itemises one (Delhivery `charge_INS`, Shiprocket
`coverage_charges`).

So most of the building blocks exist. What is missing:
- Checkout asks one courier, while booking asks all of them.
- Checkout prices come only from hand-typed zone rates.
- No idea of direct vs aggregator, and no record of which routes insure.
- No product or collection rules beyond zone + band.
- The route the shopper effectively chose is lost before booking.

## Routes: couriers vs aggregators
A courier can be reached **directly** (its own API: Delhivery, Blue Dart, DTDC ...) or **through
an aggregator** (Shiprocket, RapidShyp), which resells many couriers. Each courier × channel ×
service is a **route**:

| Route (examples) | Channel | Typical cost | Insurance |
| --- | --- | --- | --- |
| Delhivery Surface / Express | direct | lowest for Delhivery | yes (owner) |
| Delhivery Surface via Shiprocket | Shiprocket | higher than direct | through the aggregator |
| Blue Dart Apex (air) | direct | (no rate API) | **no** |
| Blue Dart Air via Shiprocket / RapidShyp | aggregator | aggregator price | through the aggregator |
| DTDC | direct | (no rate API) | **no** |

Owner's facts: direct Delhivery is usually cheapest; aggregators cost more for the same courier;
Blue Dart and DTDC direct give no insurance, so an insured shipment with them must go through an
aggregator route.

A route's identity is `providerId:serviceId` (the connected app and the bookable service in it)
plus the **carrier** it delivers with. Routes are not typed in by hand: they are what the
connected apps answer for a PIN (direct couriers give their few services, aggregators one per
carrier). The merchant attaches settings to them (see Storage), by exact route or by "carrier X
via channel Y, any service".

The shopper-facing **carrier name** comes from the route: a direct courier's own name, RapidShyp's
`parent_courier_name`, and for Shiprocket a normalised `courier_name` ("Bluedart Air",
"Blue Dart Surface 2kg" → "Blue Dart"), using a small map of known carrier names with the raw
name as the fallback.

### What each route can report
Read from the adapters in `packages/shipping-*`. They are confirmed against each courier's docs
as noted in each adapter's header, not against a live account unless the header says so.

| Route | Serviceable by PIN | COD | ETA | Live price | Insurance |
| --- | --- | --- | --- | --- | --- |
| Delhivery direct (`S`, `E`) | Yes (pin-codes API) | Yes (`cod`, `pre_paid`) | Yes (expected TAT API, per mode) | Yes (invoice charges API) | Owner: yes. Quote itemises `charge_INS` when charged. Booking does **not** request it today |
| Blue Dart direct (product code) | Yes (inbound flags) | Yes (eTail COD flags) | Yes (transit time API) | **No** rate method | **No** (owner) |
| DTDC direct | Yes (public PIN endpoint) | Yes | **No** | **No** | **No** (owner) |
| Shiprocket → each carrier | Yes | Per carrier (`cod`) | Per carrier (`etd`, `estimated_delivery_days`) | Yes, per carrier (`rate`) | Itemised as `coverage_charges` when present; adapter header: "insurance has no endpoint confirmed". **Unknown** whether a booking can ask for it |
| RapidShyp → each carrier | Yes | Per carrier (a second call with `cod: true`) | Per carrier (`edd`) | Yes, per carrier (`total_freight`) | **Unknown**: nothing in the adapter |
| Xpressbees direct | Yes | Yes | **No** (null) | Yes, `quoteOptions` | Unknown |
| Ekart direct | Yes | Yes | Yes (min/max) | `quoteRate` (one price) | Unknown |
| Shadowfax direct | Yes | Yes | **No** | **No** | Unknown |
| India Post Speed Post | Yes (PIN directory) | Merchant setting | Yes (delivery standards) | Yes, from the gazetted tariff in the repo (no network call) | Unknown |
| DHL Express, FedEx | Export only | n/a | n/a | n/a | Not used at checkout |

What this means for the design:
- Every domestic route can answer **serviceable + COD**. That is the floor.
- **ETA**: where a route has none, we use the store's default transit days, marked as an
  estimate ("usually 4–6 days"). Under the `fastest` strategy, a route with a real ETA beats an
  estimated one on the same date.
- **Price**: a route without a live price (Blue Dart direct, DTDC, Shadowfax) can back an
  option only when the merchant gives it a **cost card** (₹ for the first 500 g + ₹ per extra
  500 g, prepaid and COD). Without one it is skipped, with "no price" in the trace.
- **Insurance cannot be read from any API.** It is a per-route setting the merchant confirms
  (seeded from the owner's facts above: Delhivery direct on, Blue Dart and DTDC direct off,
  aggregator routes on). Booking must also start asking the courier for insurance where its API
  takes a flag (Delhivery, Shiprocket and RapidShyp fields to be confirmed against their docs
  in P1). Until a route's booking really requests it, the admin shows "insured per your
  courier contract" next to it.
- **Insurance price**: the quote's own insurance line when the route itemises one (quotes are
  asked with the declared value, `ShippingQuery.orderValue`); otherwise the route's setting
  (% of order value with a minimum ₹).
- Per-call latency is typically 300–1500 ms. The current hard timeout is
  `COURIER_TIMEOUT_MS = 6000`, far over a checkout budget, so checkout needs its own shorter
  deadline (see Latency).

## How Shopify apps do this (the model we borrow)
- **Carrier-calculated rates** (Shopify's CarrierService API): Shopify calls the app's URL with
  the cart and address, and the app returns rates with name, price and min/max delivery date.
  If the app errors or times out (Shopify allows 3–10 s, depending on traffic), checkout shows
  **backup rates**: the merchant's flat rates. Shopify also caches identical requests (same
  variants, quantities, box and carrier). We copy all three ideas: a deadline, backup rates and
  a quote cache.
- **Delivery customizations** (Shopify Functions): hide, rename or reorder the delivery
  options after they are computed, by cart and address conditions.
- **Shipping rules apps** (Advanced Shipping Rules, Intuitive Shipping and similar): an ordered
  list of *condition → action* rules. Conditions include postal code, state, SKU, product tag,
  collection, weight, cart value and item count. Actions include show or hide a rate, add or
  subtract a fixed amount or %, set a price, rename, and block a product from an area.
  Product groups decide which rate applies to a mixed cart.
- **Estimated delivery date apps**: processing days, a daily cut-off time, holidays, a buffer
  on top of the carrier's transit time, and dates shown as a range. Our dispatch policy
  (`ShippingPolicySchema`: cut-off, working days, delivery days, holidays) already covers
  everything except the buffer.

Build vs adopt (`docs/open-source-radar.md`): no open-source project offers Indian courier
checkout options as something we could adopt. Saleor (BSD-3) and Medusa (MIT) both treat
"calculated" shipping as a provider call with a fallback, which is the pattern we already
follow. A generic rules-engine library (json-rules-engine and similar) is not worth a
dependency: our conditions are a short typed list evaluated in a pure function, the same way
`rates.ts` and `courier-rates.ts` already work. **Recommendation: build it ourselves on the
existing adapters. Nothing is copied.**

## What the shopper sees
The Shipping step keeps today's radio cards (`delivery-method.tsx`). With the app on, each card
is a **delivery option**, titled with the option and the **courier** (never the aggregator):

```
( ) Standard · Delhivery              Arrives Mon 3 Nov – Wed 5 Nov          Free
(•) Express · Delhivery     Fastest   Arrives Fri 31 Oct                     ₹150
      (•) Delhivery                   Fri 31 Oct                             ₹150
      ( ) Blue Dart Air               Thu 30 Oct                             ₹180
    Cash on delivery not available with Express

[x] Insure this shipment (+₹40)
```

- **Title**: "Express · Blue Dart". The carrier name comes from the route (see Routes).
- **Sub-choices**: only when a product rule allows alternatives (the Mice rule). Each is
  priced and dated on its own with the same formula. The rule's default is preselected.
- **Arrival**: a date range from the route's ETA and the store's calendar, plus the option's
  buffer. Routes without an ETA read "usually 4–6 days" instead of a date.
- **Price**: final and tax-inclusive, already rounded up to the next ₹10. "Free" when the
  option's free-above threshold applies, with the list price struck through. The cart's "Add ₹X
  for free shipping" line keeps working from the option thresholds.
- **Insurance**: one checkbox under the options, shown when the picked option has insurance on
  by default (optionally only above an order value). Unticking re-picks the routes without the
  insurance filter and updates the prices. Hidden when a product rule makes insurance required.
- **COD**: Express is prepaid only. Its card says so, and the Payment step greys out COD with
  that reason (`codBlocked` / `codNote` already exist). Standard keeps COD (see Choosing a route).
- Fastest badge; Standard preselected. A rule can preselect another option.
- Unserviceable: the existing "we don't deliver to this PIN code" message, only when **every**
  route truly said no.

The product page delivery checker (`deliveryCheckerBlocks`) and the cart can use the same engine
later (phase 4), so the date there matches checkout.

## Model

### Delivery option
What the merchant defines, and the shopper sees as one card.

| Field | Meaning |
| --- | --- |
| `name`, `description` | Card title and optional line ("Packed and shipped the same day") |
| `speed` | `standard` / `express`; used for sorting and to match services (Delhivery `E` is express). No same-day or next-day in v1 |
| `routes` | Which routes may carry it: "any connected route of speed X" (default), or a list of couriers/channels/services to allow or exclude |
| `strategy` | `cheapest` (tie → prefer direct) or `fastest` (earliest arrival; tie → cheapest). Standard defaults to cheapest, Express to fastest |
| `preferDirectWithinPaise` | Optional: if a direct route costs at most ₹X more than the cheapest aggregator route, take the direct one |
| `price` | `route` (default: route cost + markup ₹ or %, + insurance, rounded up to the next ₹10) or `zone` (the Shipping rates the cart falls into, today's behaviour); optional `freeAbove` and min/max caps |
| `insurance` | Default `on` / `off`, optional `onlyAbovePaise` (order value) |
| `eta` | Route ETA (default) or fixed days; `bufferDays`; `cutoff` override; `processingDays` |
| `cod` | `prepaid_only` (forced for express) or `allowed` (standard); optional COD fee override |
| `when` | Base availability conditions (same shape as P3 rule conditions) |
| `position` | Card order |

Today's zones and rates stay as they are. They are the `zone` price source and the backup for
Standard when couriers are down. A store with the app installed but no options behaves exactly
as today.

### Choosing a route for an option
For each option, a pure function:

1. **Pool**: the routes the option allows, narrowed by the cart's product route rules (below).
2. **Ask** every route in the pool in parallel (one call per connected app: an aggregator's one
   call answers for all its carriers), within the checkout deadline.
3. **Drop** routes that don't fit, each with a reason for the trace: not serviceable; insurance
   is on and the route doesn't insure; COD is needed and the route has no COD; wrong speed; no
   price (no live price and no cost card); over the option's max ETA.
4. **Pick** by `strategy`:
   - `cheapest`: lowest route cost (before markup, including insurance when on). Tie → direct.
   - `fastest`: earliest latest-arrival date. Tie → cheapest, then direct.
   - Then `preferDirectWithinPaise`: if the winner is an aggregator route and a direct route that
     fits is within ₹X of it (and, for `fastest`, arrives on the same date), the direct route
     wins.
   - A product rule's **default** route beats the strategy when it fits.
5. **Price** the winner (and each allowed alternative): route cost + markup + insurance, round
   up to the next ₹10, then apply `freeAbove` and caps.

**COD on Standard.** The step order is address → shipping → payment, so COD isn't known when the
cards are drawn. Standard is picked twice from the same answers: once for prepaid and once with
"COD needed". The card shows the prepaid pick. If the shopper then chooses COD, the Payment step
shows the COD route's total ("Cash on delivery: +₹30, ships with Delhivery"), the same way
today's COD fee works, and that route is what the order saves.

### Product and collection route rules (highest priority)
A short ordered list, separate from the general rules (P3) because it decides **which routes are
allowed** before any option is picked.

| Field | Meaning |
| --- | --- |
| `target` | Products, collections, product tags, or product types |
| `options` | Which delivery options it applies to (all, or e.g. Express only) |
| `routes` | Allowed routes: courier, optional channel (direct / Shiprocket / RapidShyp / any), optional service (e.g. Delhivery `E`, Blue Dart Air) |
| `default` | The route to use when it fits (beats the option's strategy) |
| `alternatives` | Routes the shopper may switch to, shown as sub-choices. Empty = no choice |
| `insurance` | `follow_option` (default) or `required` (hides the checkbox) |
| `position` | Order, which also breaks conflicts (below) |

The owner's two rules:
- **Glasspads** (collection) → all options → routes: Delhivery, any service, channel any that
  insures → no alternatives. Standard becomes Delhivery Surface, Express becomes Delhivery
  Express. If the shopper unticks insurance, it is still Delhivery (the rule names the courier),
  and direct Delhivery wins on price.
- **Mice** (collection) → Express → routes: Delhivery `E` (default), Blue Dart Air (any channel)
  as an alternative. Standard is untouched.

**Mixed carts.** Items with no rule allow every route. For each option:
1. Intersect the allowed routes of every rule the cart's items match.
2. Not empty → that is the pool. The default is the highest-placed rule's default when it is in
   the pool; alternatives are those every matching rule allows.
3. Empty → **the highest-placed rule wins** (its routes, default and alternatives), and the trace
   says which rule was overruled. The merchant orders rules so the protective one (Glasspads,
   insurance) sits above the convenience one (Mice).
4. If even that pool has nothing serviceable, the option hides for this cart.

Recommendation: **highest-placed rule** at launch, not splitting. Splitting a cart into two
shipments needs two charges at checkout, two bookings and a split order view: a separate later
phase (P5) if real carts need it. Placement order is explicit, easy to explain in the admin
("Rules higher in the list win when a cart can't satisfy all of them"), and Try a PIN shows the
outcome for any mix.

### General rules (P3)
An ordered list of *conditions → actions*, run after the routes are picked. A rule may stop
processing (`stop`), like Shopify's priority order.

Conditions:
- **Destination**: PIN code list or prefix (`560*`, uploaded CSV up to ~20k codes), state, metro
  or not (from the PIN directory's district), the zone the address falls in
- **Cart**: value (after discounts), weight (actual and volumetric through `parcel.ts`), item
  count, number of parcels (multi-warehouse split)
- **Products**: any, all or none of the items have tag X / are in collection Y / have product
  type Z / vendor; a specific SKU
- **Customer**: tag (wholesale, VIP), first order
- **Time**: day of week, time of day, a date range (Diwali)
- **Route answer**: ETA over N days; no live price; from courier X

Actions:
- **Hide** the option (e.g. hide Express for items tagged `bulky`; hide everything for
  `no-ship-NE` items to NE states, which acts as a product block)
- **Price**: set to ₹X, add or subtract ₹X or %, make free, cap at ₹X
- **Rename** or add a note line
- **Route**: exclude courier/channel X (e.g. never DTDC to J&K), change the strategy
- **ETA**: add N buffer days, use fixed days, change the cut-off
- **COD**: disable COD, set the COD fee
- **Preselect** this option

Evaluation is a pure function in `packages/core/src/shipping/delivery-options/` (no database,
no clock passed implicitly), like `rates.ts`:
`resolveDeliveryOptions(config, cart, destination, routeAnswers, now) → { options, trace }`.
The `trace` (every route's quote, which were dropped and why, which won and why, which rules
fired) powers the admin's "Try a PIN" and support questions.

### Storage
- `delivery_route_setting`: per store, keyed by exact route (`providerId:serviceId`) or by
  carrier + channel. Fields: `insures`, insurance rate (% + min ₹) when the quote doesn't
  itemise one, cost card for routes without a live price, enabled.
- `delivery_option`, `delivery_route_rule` (P1); `delivery_rule`, `pin_list` (P3). Store-scoped,
  RLS, position ordering, JSONB for conditions and actions validated by zod. They change rarely,
  so they are cached per store in Redis and busted on save.
- Order: extend `OrderShippingSnapshot` (JSONB, no migration for the column itself) with
  `deliveryOptionId`, `deliveryOptionName`, the **route** (`providerId`, `channel`
  `direct`/aggregator, `carrier`, `serviceId`, `serviceLabel`), `pickedBy` (`strategy` /
  `rule:<id>` / `shopper`), `insured`, `insurancePaise`, `markupPaise`, `courierCostPaise`
  (what the route quoted), `promisedEarliest`/`promisedLatest` (`YYYY-MM-DD`), `quoteSource`
  (`live` / `cache` / `backup`). `order.shipping_rate_name` keeps "Express · Blue Dart" so
  invoices and emails need no change.

## Latency budget and caching
Target: options on screen ≤ 1 s after the PIN is complete (p95), and ≤ 300 ms when cached.

1. **Start early.** Fire the lookup when the 6th PIN digit is typed (`useCheckoutShipping`
   already waits for `isFullPincode`). Lookups for an address already saved on the account
   start on page load.
2. **Ask in parallel, with a deadline.** Every connected app that backs any route in any pool is
   asked at once (`Promise.allSettled`) with a checkout timeout of **800 ms** per call
   (`COURIER_TIMEOUT_MS` stays 6 s for booking). At the deadline we answer with whatever arrived.
   Late answers are still written to the cache for the next shopper.
3. **Cache by what changes the answer**:
   - Serviceability + COD + TAT: per app, origin>PIN, 24 h (exists).
   - Live price: per app, origin>PIN, **weight slab** (rounded up to the courier's 500 g step),
     payment mode, value bucket (COD and insurance depend on value: ₹0–2k, 2–5k, 5k+), 6 h.
   - Stale-while-revalidate (P2): an entry up to 7 days old is used when the live call misses
     its deadline, and refreshed in the background.
4. **Circuit breaker (P2).** An app that failed 3 times in 60 s is skipped for 5 min (a Redis
   counter per store and app), so a Shiprocket outage costs nothing after the first few
   checkouts.
5. **Quote snapshot.** The computed options (with the winning route and alternatives) are saved
   for 30 min in Redis under a quote id (cart id + cart hash + address PIN + config version).
   `placeOrder` prices from the snapshot by quote id, not by calling couriers again. If the
   snapshot is missing or the cart changed, it recomputes from **cache only** (no live calls
   inside the order transaction). If the result is higher than what was shown, the order is
   charged the lower amount (the anti-goal). Zone rates keep today's path.
6. **Warm cache (P4).** A nightly job refreshes serviceability for the store's top 500 order
   PINs per app, within each courier's rate limits.
7. **Rate limit.** The existing per-IP limit on `checkoutShippingAction` stays, so nobody burns
   the store's courier quota from a script.

## Fallback when couriers are down or slow
"Down" for an option means no route in its pool answered within the deadline and none has a
cached answer (fresh, or stale up to 7 days once P2 lands).

- **Express** hides. A promise we can't check is worse than no option.
- **Standard** shows at the store's existing **zone rate**, with the store's default transit
  days ("usually 4–6 days") and the store's COD setting. `quoteSource: 'backup'`. The order
  saves no route, and booking falls back to `courierRule` with the product route rules applied.
- Some routes answered, some didn't: pick among those that answered; the trace notes the
  missing ones.
- Nothing serviceable at all: if every route truly said no, show "we don't deliver to this PIN";
  if it was failures only, show the zone rates as today.

A transport failure is never shown as "not serviceable" (the existing `CourierError` vs
`serviceable: false` split).

The admin shows health on the app page (last error per app, breaker open since, share of
checkouts on backup in the last 24 h), and an order placed on backup is marked so in the
order's shipping card.

## From checkout to order, shipment and label
1. **Order**: the snapshot records the option, the exact route, insurance, promised dates and
   the route's quoted cost. The order page shows "Express · Blue Dart Air via Shiprocket ·
   promised by Fri 31 Oct · insured" (the merchant sees the channel, the shopper never does).
2. **Create shipment** (order page, Shipments workspace, bulk) **books exactly that route**:
   the saved `providerId` + `serviceId`, with `insured` from the order. The rate table shows it
   preselected with "Chosen at checkout" and its cost against what the shopper paid. `courierRule`
   is not consulted for app orders.
3. **If the route fails at booking** (no longer connected, no longer serves the PIN, lost COD,
   the API refused), the dialog shows the reason ("Blue Dart Air via Shiprocket: pincode not
   serviceable") and a **fallback**: the next route by the option's strategy among those that
   still fit the order's constraints (product rule pool, insurance, COD, same or faster speed),
   with its cost difference ("₹20 more than charged"). The merchant confirms it or picks another
   row. Bulk booking puts such orders in a "Needs a decision" list with the same fallback, never
   books a different route silently.
4. **Aggregators**: for Shiprocket and RapidShyp, `pushOrder` already sends new orders as
   pending orders. It passes the chosen carrier where the API takes one, so the aggregator's
   panel shows the right courier too.
5. **Label**: unchanged. The courier prints it. Our packing slip and the order list show the
   option name and promised date, so the packer knows which parcels go out first. The
   Shipments "To book" tab sorts Express first and flags any whose cut-off is about to pass.
6. **After delivery** (P4): promised vs delivered date per route and option feeds a small
   report, and can later re-rank `fastest` with real data instead of the courier's claim.
7. **Profit**: `courierCostPaise` + insurance against the shipping charged gives shipping margin
   per order (ties into the parked profit plan, `profit-build-plan`).

## Admin UI
Full pages and centred dialogs only, no right drawers. Card footer buttons sit on the right.
Copy in `apps/admin/src/data/delivery-options.ts` + `data/hi/`.

- **Apps → Delivery options** (`/apps/delivery-options`), full page:
  - **Routes** card: each connected app with a status chip (Connected / Error / Not connected →
    link to its Connect page), and under it the routes it offers (direct services, or the
    aggregator's carriers from the last quote) with what each can give (Serviceability · ETA ·
    Live price · COD · Insures). Row → **route dialog**: insures on/off, insurance rate, cost
    card, enabled. Health line per app.
  - **Delivery options** card: table (name, strategy, price, insurance, COD), drag to reorder,
    row → edit page, "Add option" → page. Empty state offers "Standard (cheapest) + Express
    (fastest, prepaid)" as a preset.
  - **Product route rules** card: ordered list with a one-line summary each ("Glasspads → all
    options → Delhivery only, insured"; "Mice → Express → Delhivery Express, or Blue Dart Air"),
    drag to reorder with the note "Rules higher in the list win when a cart can't satisfy all
    of them". Add or edit opens a **dialog**: products/collections picker, options, allowed
    routes, default, alternatives, insurance.
  - **Rules** card (P3): the general rules, same list pattern, condition builder dialog.
  - **Try a PIN** card: PIN, cart (products picker or value + weight), COD toggle, insurance
    toggle → shows the cards exactly as checkout would, plus **every route's quote** per option
    (cost, ETA, COD, insures, live or cache, ms), which ones were dropped and why, which one won
    and why ("cheapest; direct preferred within ₹10"; "default of rule Glasspads"), and which
    rules fired. Reuses `settings/shipping-try-pin.tsx`.
- **Option page** (`/apps/delivery-options/options/[id]`, new at `/new`): cards for Name and
  display · Routes and strategy (allowed routes, cheapest/fastest, prefer direct within ₹X) ·
  Price (route + markup or zone, free above, caps) · Insurance (default, only above ₹X) ·
  Arrival (route ETA or fixed, buffer, cut-off, processing days) · Cash on delivery ·
  Availability. Save bar like the zone page.
- **PIN lists** (P3): a dialog from the rule builder ("Manage lists"). Paste or upload CSV, and
  see the count and invalid lines.
- Settings → Shipping keeps zones and rates, with one line: "Delivery options app is on: checkout
  options come from it; these rates are the Standard backup when couriers are down."

## Phased build plan
Each phase is a PR into `dev`, verified at the end (lint, test, build). Product route rules
move into P1 because the owner needs Glasspads → Delhivery and Mice → Delhivery Express or
Blue Dart Air first.

**P1: Routes, options and product route rules (L)**
- Engine: route pool, parallel quotes with the 800 ms deadline, drop reasons, `cheapest` /
  `fastest` strategies, prefer direct within ₹X, route price (cost + markup + insurance, round
  up to ₹10), Standard picked for prepaid and COD.
- `delivery_route_setting`, `delivery_option`, `delivery_route_rule` tables. Rule pools,
  defaults, alternatives, mixed-cart intersection with highest-placed rule winning.
- Checkout: "Express · Blue Dart" cards, sub-choices, insurance checkbox, Express prepaid only,
  backup (Standard at zone rate, Express hidden). Live price cache by slab and the quote
  snapshot read by `placeOrder`.
- Order snapshot with the exact route. Create shipment and bulk book that route; failure shows
  the reason and the fallback. Adapters send the insurance flag where the API takes one.
- App page: Routes card and dialog, options list and page, product route rules, Try a PIN with
  the full trace.
- Result for Waimers: Standard (cheapest, COD) + Express (fastest, prepaid), Glasspads always on
  Delhivery insured, Mice offering Delhivery Express or Blue Dart Air.

**P2: Resilience and margin (S–M)**
- Stale-while-revalidate, circuit breaker, health line and "placed on backup" marker.
- Shipping margin on the order (cost + insurance vs charged).

**P3: General rules (M–L)**
- `delivery_rule` + `pin_list` tables, condition builder dialog, the conditions and actions
  above, trace in Try a PIN, cart free-shipping hint from the app.
- Import: the owner's Waimers Shopify rules recreated as rules (by hand or with a small mapper
  if they come as a list).

**P4: Same promise everywhere + learning (S–M)**
- Product page and cart use the engine for "Get it by Fri", so the date matches checkout.
- Promised vs delivered report per route and option. Optional "fastest by real data".
- Nightly warm cache for top PINs. Shipments "To book" sorted by promise and cut-off.

**P5 (later, only if needed): split shipments** for carts whose product rules share no route.

## Owner decisions (29 Oct 2026)
1. **Routes**: one courier can be reached directly or through aggregators; each courier ×
   channel is a route with its own cost, ETA, COD and insurance. Direct Delhivery is usually
   cheapest; Blue Dart and DTDC direct have no insurance. (Routes section.)
2. **Choosing a route**: ask all eligible routes in parallel, drop the ones that don't fit, pick
   by the option's strategy (cheapest → tie direct; fastest → tie cheapest), optional prefer
   direct within ₹X. (Choosing a route.)
3. **Product and collection route rules** with highest priority: Glasspads → Delhivery only;
   Mice → Delhivery Express, Blue Dart Air as an alternative. Mixed carts: intersect, and when
   nothing is common the highest-placed rule wins; splitting is P5. (Product route rules.)
4. **Shopper sees** "Express · Blue Dart · Arrives Fri 31 Oct · ₹150": the courier, never the
   aggregator; alternatives as sub-choices.
5. **Price**: route cost + markup (₹ or %) + insurance, rounded up to the next ₹10.
6. **Insurance**: default per option (optionally only above an order value); the shopper can
   untick it.
7. **COD**: Express and faster are prepaid only; COD stays on Standard.
8. **No same-day or next-day** at launch.
9. **Couriers down or slow**: only Standard at the existing zone rate; Express hidden.
10. **Booking**: the order saves the exact route; Create shipment books it; on failure, show the
    reason and the fallback.
11. **Admin**: Try a PIN shows every route's quote, the winner and why; full pages and dialogs
    only.
12. **Phases**: product route rules moved into P1.

## Open questions
1. **Insurance per route**: we seed Delhivery direct and the aggregator routes as "insures", and
   Blue Dart and DTDC direct as not. Please confirm insurance (or "secure shipment") is turned
   on in the Waimers Shiprocket and RapidShyp accounts, and roughly what each charges, since
   neither quote reliably itemises it.
2. **Waimers Shopify rules** (for P3, not blocking P1): screenshots or an export of the app's
   rules, so P3 can recreate them.
