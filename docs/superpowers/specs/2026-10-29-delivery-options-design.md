# Delivery options at checkout (design)

Owner, 29 Oct 2026: "We already use those delivery apps for courier, but we can also use them
for checkout showing possible options. We have to create an app which shows: your Delhivery,
Shiprocket, RapidShyp, Bluedart etc. app is connected, use them to show at checkout. I created
something similar for Waimers on Shopify with rules."

Status: design only. No product code yet. Open questions at the end, including a request for
the Waimers Shopify rules.

## What it is
An app, **Delivery options** (`/apps/delivery-options`), that turns the courier apps a store
has already connected into the choices a shopper sees at checkout:

- which options exist for this PIN code (Standard, Express, Same day ...), from what the
  couriers say they can do,
- each option's arrival date, from the courier's own transit time and the store's dispatch
  calendar,
- each option's price, from the store's rates or from the courier's cost with a markup,
- whether cash on delivery is offered with it,
- a rules list (by PIN code or state, weight, cart value, product tags or collections) that
  hides, renames, reprices or reroutes options, like the Shopify apps the owner used.

The courier picked for an option is saved on the order, so Create shipment opens with that
courier and service already selected.

Goals:
- More honest dates and fewer failed COD orders: the shopper sees what the courier really
  serves for their PIN.
- An Express option at checkout without the merchant keeping a second price table by hand.
- Checkout never waits more than about 1 s on couriers. When a courier is down, checkout still
  works.

Non-goals (v1): booking a time slot or delivery date picker (Shopify's "local delivery" slots),
store pickup (a separate feature), international carrier rates at checkout (DHL Express and FedEx
stay booking-only).

Anti-goals: never charge more than the price the shopper saw; never show an option the
merchant cannot book; never let one slow courier blank the Shipping step.

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
(`compareCourierRates` in `core/shipping/courier-rates.ts`): one row per bookable service,
with price, transit days, COD support, and badges (cheapest, fastest, recommended). The store's
booking rule (`courierRule`: cheapest / fastest / preferred / per-state) picks one
(`chooseCourier`, used in `shipments-workspace.service.ts`). The booking passes `serviceId`
(Delhivery mode `S`/`E`, the carrier id inside Shiprocket or RapidShyp).

So most of the building blocks exist. What is missing:
- Checkout asks one courier, while booking asks all of them.
- Checkout prices come only from hand-typed zone rates.
- No rules beyond zone + band.
- The courier the shopper effectively chose is lost before booking.

## What each courier can tell us at checkout time
Read from the adapters in `packages/shipping-*`. They are confirmed against each courier's docs
as noted in each adapter's header, not against a live account unless the header says so.

| Courier | Serviceable by PIN | COD flag | Transit days (TAT) | Live price | Speeds |
| --- | --- | --- | --- | --- | --- |
| Delhivery | Yes (pin-codes API) | Yes (`cod`, `pre_paid`) | Yes (expected TAT API, per mode) | Yes, `quoteOptions` (invoice charges API) | Surface, Express |
| Shiprocket (aggregator) | Yes | Per carrier | Per carrier (`estimated_delivery_days`, `etd`) | Yes, one option per carrier | Each carrier's service (air/surface) |
| RapidShyp (aggregator) | Yes | Per carrier | Per carrier | Yes, one option per carrier | Each carrier's service |
| Xpressbees | Yes | Yes | **No** (null) | Yes, `quoteOptions` | Its service list |
| Blue Dart | Yes (inbound flags) | Yes (eTail COD flags) | Yes (transit time API) | **No** rate method in the adapter | Apex/air vs ground flags |
| Ekart | Yes | Yes | Yes (min/max) | `quoteRate` (one price) | One |
| DTDC | Yes (public PIN endpoint) | Yes | **No** | **No** | One |
| Shadowfax | Yes | Yes | **No** | **No** | One |
| India Post | Yes (PIN directory) | Merchant setting | Yes (delivery standards) | Yes, from the gazetted tariff typed into the repo (no network call) | Speed Post |
| DHL Express, FedEx | Export only | n/a | n/a | n/a | Not used at checkout |

What this means for the design:
- Every domestic courier can answer **serviceable + COD**. That is the floor every option works
  from.
- **ETA** is real for Delhivery, Shiprocket, RapidShyp, Blue Dart, Ekart and India Post. For
  the rest we use the store's default transit days, marked as an estimate (the same
  `etaFromSettings` idea booking uses).
- **Live price** exists for Delhivery, Shiprocket, RapidShyp, Xpressbees, Ekart and India Post.
  A courier without one can still back an option, but that option must take its price from a
  flat amount or the zone rate.
- Aggregators give the widest choice with one call (Shiprocket lists Blue Dart Air, Delhivery
  Surface and others, each with a price and ETA). For most stores that one call is the cheapest
  way to fill both Standard and Express.
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
is a **delivery option**:

```
( ) Standard                     Arrives Mon 3 Nov – Wed 5 Nov            Free
(•) Express          Fastest     Arrives tomorrow, Fri 31 Oct            ₹99
( ) Same day (Delhi NCR only)    Order in 2 h 14 m · arrives today       ₹149
    Cash on delivery not available with Express
```

- **Name**: the merchant's ("Standard", "Express"), not the courier's. Showing the courier
  ("Blue Dart Air") is a per-option switch, off by default. Shoppers choose by speed and price,
  and a courier name on the card promises a courier the merchant may need to change at booking.
- **Arrival**: a date range from the backing courier's TAT and the store's calendar, plus the
  option's buffer. "Order within 2 h 14 m" shows only before a same-day or next-day cut-off.
  Dates the store had to guess (no courier TAT) read "usually 4–6 days" instead of a date.
- **Price**: final and tax-inclusive. "Free" when a threshold applies, with the list price
  struck through. The cart's "Add ₹X for free shipping" line keeps working from the app's
  thresholds.
- **COD**: a small line under the card when the picked option cannot take COD. The Payment step
  then greys out COD with that reason (`codBlocked` / `codNote` already exist). If only one
  option supports COD and the shopper has picked COD first, the options that can't take it are
  shown disabled with the reason rather than hidden. The order of steps is address → shipping →
  payment, so normally the option decides COD.
- Fastest badge, cheapest preselected (today's rule). A rule can preselect another option.
- Unserviceable: the existing "we don't deliver to this PIN code" message, only when **every**
  backing courier truly said no.

The product page delivery checker (`deliveryCheckerBlocks`) and the cart can use the same engine
later (phase 4), so the date there matches checkout.

## Model

### Delivery option
What the merchant defines, and the shopper sees as one card.

| Field | Meaning |
| --- | --- |
| `name`, `description` | Card title and optional line ("Packed and shipped the same day") |
| `speed` | `standard` / `express` / `same_day` / `next_day`; used for sorting and default service matching |
| `services` | The courier services that may carry it, in priority order: e.g. `delhivery:E`, `shiprocket:<Blue Dart Air id>`, `bluedart:apex`. Or "any service of speed X from any connected courier" |
| `pick` | How one service is chosen among those that answered: `priority` (first in the list that serves the PIN), `cheapest`, `fastest` |
| `price` | `flat` (₹X), `zone` (use the Shipping rates the cart falls into, today's behaviour), `courier` (courier cost + markup % + markup ₹, rounded up to ₹1/₹9/₹10), each with optional `freeAbove` and min/max caps |
| `eta` | Use courier TAT (default) or fixed days; `bufferDays` added on top; `cutoff` override (e.g. Express 12:00 vs store 14:00); `processingDays` for made-to-order items |
| `cod` | `follow_courier` (default) / `never` / `always_if_courier_can`; optional COD fee override (replaces the rate's `codSurchargePaise`) |
| `when` | Base availability conditions (same shape as rule conditions), e.g. Same day only for PIN `110*`, `122*`, `201*` |
| `showCourier` | Show the carrier name on the card |
| `position` | Card order |

Today's zones and rates stay as they are. They are the `zone` price source and the backup
rates. A store with the app installed but no options behaves exactly as today.

### Rules
An ordered list. Each rule has **conditions** (all must hold) and **actions**. They run in
order after the options are computed. A rule may stop processing (`stop`), like Shopify's
priority order.

Conditions:
- **Destination**: PIN code list or prefix (`560*`, uploaded CSV up to ~20k codes), state, metro
  or not (from the PIN directory's district), the zone the address falls in
- **Cart**: value (after discounts), weight (actual and volumetric through `parcel.ts`), item
  count, number of parcels (multi-warehouse split)
- **Products**: any, all or none of the items have tag X / are in collection Y / have product
  type Z / vendor; a specific SKU
- **Customer**: tag (wholesale, VIP), first order
- **Payment**: COD vs prepaid (only for actions that make sense before payment, such as a COD
  fee)
- **Time**: day of week, time of day, a date range (Diwali)
- **Courier answer**: the service's ETA is over N days; the courier has no live price; the
  service is from courier X

Actions:
- **Hide** the option (e.g. hide Express for items tagged `bulky`; hide everything for
  `no-ship-NE` items to NE states, which acts as a product block)
- **Price**: set to ₹X, add or subtract ₹X or %, make free, cap at ₹X
- **Rename** or add a note line
- **Courier**: exclude courier/service X (e.g. never DTDC to J&K), force courier/service X, change
  the pick strategy
- **ETA**: add N buffer days, use fixed days, change the cut-off
- **COD**: disable COD for this option, set the COD fee
- **Preselect** this option

Evaluation is a pure function in `packages/core/src/shipping/delivery-options/` (no database,
no clock passed implicitly), like `rates.ts`:
`resolveDeliveryOptions(config, cart, destination, courierAnswers, now) → { options, trace }`.
The `trace` (which rule hit and why each service was dropped) powers the admin's "Try a PIN"
preview and support questions.

Mixed carts: conditions on products use any, all or none. Per-product-group pricing (Shopify's
"product groups add up") is out of v1. A rule can hide or reprice instead, which covers the
common cases (bulky surcharge, fragile items no Express).

### Storage
- `delivery_option` and `delivery_rule` tables (store-scoped, RLS, position ordering, JSONB for
  conditions and actions validated by zod). They change rarely, so they are cached per store in
  Redis and busted on save.
- PIN lists for rules: a `pin_list` table (name + text[] or a child table) so a 20k-code list is
  not repeated in every rule.
- Order: extend `OrderShippingSnapshot` (JSONB, no migration for the column itself) with
  `deliveryOptionId`, `deliveryOptionName`, `providerId`, `serviceId`, `carrier`,
  `courierCostPaise` (what the courier quoted), `promisedEarliest`/`promisedLatest`
  (`YYYY-MM-DD`), `quoteSource` (`live` / `cache` / `backup`). `order.shipping_rate_name` keeps
  the card name so invoices and emails need no change.

## Latency budget and caching
Target: options on screen ≤ 1 s after the PIN is complete (p95), and ≤ 300 ms when cached.

1. **Start early.** Fire the lookup when the 6th PIN digit is typed (`useCheckoutShipping`
   already waits for `isFullPincode`). Lookups for an address already saved on the account
   start on page load.
2. **Ask in parallel, with a deadline.** Every courier that backs any option is asked at once
   (`Promise.allSettled`) with a checkout timeout of **800 ms** per call (`COURIER_TIMEOUT_MS`
   stays 6 s for booking). At the deadline we answer with whatever arrived. Late answers are
   still written to the cache for the next shopper.
3. **Cache by what changes the answer**:
   - Serviceability + COD + TAT: per courier, origin>PIN, 24 h (exists).
   - Live price: per courier, origin>PIN, **weight slab** (rounded up to the courier's 500 g
     step), payment mode, value bucket (COD fee depends on value: ₹0–2k, 2–5k, 5k+), 6 h. Courier
     prices change monthly at most, and the slab rounding makes the hit rate high.
   - Stale-while-revalidate: an entry up to 7 days old is used when the live call misses its
     deadline, and refreshed in the background.
4. **Circuit breaker.** A courier that failed 3 times in 60 s is skipped for 5 min (a Redis
   counter per store and courier), so a Shiprocket outage costs nothing after the first few
   checkouts.
5. **Quote snapshot.** The computed options are saved for 30 min in Redis under a quote id
   (cart id + cart hash + address PIN + option config version). `placeOrder` prices from the
   snapshot by quote id, not by calling couriers again. If the snapshot is missing or the cart
   changed, it recomputes from **cache only** (no live calls inside the order transaction).
   If the result is higher than what was shown, the order is charged the lower amount (the
   anti-goal). This replaces the current "re-price the rate" step only for app options. Zone
   rates keep today's path.
6. **Warm cache (later).** A nightly job refreshes serviceability for the store's top 500 order
   PINs per backing courier, within each courier's rate limits.
7. **Rate limit.** The existing per-IP limit on `checkoutShippingAction` stays, so nobody burns
   the store's courier quota from a script.

## Fallback when a courier is down
Order of preference for each option:
1. Live answer from a service in the option's list.
2. Cached answer (fresh, then stale up to 7 days) for a service in the list.
3. The next service in the list (`priority`), or the remaining ones (`cheapest` / `fastest`).
4. **Backup**: no courier answered for this option. Then:
   - `flat` / `zone` price options still show, with the store's default transit days
     ("usually 4–6 days"). COD follows the store's COD setting. `quoteSource: 'backup'`.
   - `courier` price options use the option's **backup price** (a required field when price
     is `courier`), or hide when the merchant chose "hide when couriers don't answer".
   - Express, same-day and next-day options hide on backup by default, since a promise we
     can't check is worse than no option.
5. Nothing serviceable at all:
   - If every courier truly said no, show "we don't deliver to this PIN".
   - If it was failures only, show the zone rates as today.

   A transport failure is never shown as "not serviceable" (the existing `CourierError` vs
   `serviceable: false` split).

The admin shows courier health on the app page (last error, breaker open since, share of
checkouts on backup in the last 24 h), and an order placed on backup is marked so in the
order's shipping card.

## From checkout to order, shipment and label
1. **Order**: the snapshot above records the option, courier, service, promised dates and the
   courier's quoted cost. The order page shows "Express · via Blue Dart Air (Shiprocket) ·
   promised by Fri 31 Oct".
2. **Create shipment** (order page, Shipments workspace, bulk): the rate table preselects the
   order's `providerId` + `serviceId` row with a "Chosen at checkout" badge, ahead of
   `courierRule`. If that service is no longer connected, no longer serves the PIN or has lost
   COD:
   - the dialog falls back to `courierRule`,
   - it shows why ("Blue Dart Air no longer serves 795001: picked Delhivery Express"),
   - it keeps only services of the same or faster speed when the order paid for Express,
     unless the merchant overrides.

   Bulk booking applies the same order: checkout choice → booking rule.
3. **Aggregators**: for Shiprocket and RapidShyp, `pushOrder` already sends new orders as
   pending orders. It passes the chosen carrier where the API takes one, so the merchant
   sees the right courier in the aggregator's panel too.
4. **Label**: unchanged. The courier prints it. Our packing slip and the order list show the
   option name and promised date, so the packer knows which parcels go out first. The
   Shipments "To book" tab sorts Express and same-day first and flags any whose cut-off is
   about to pass.
5. **After delivery**: the promised date against the actual delivered date per courier and
   option feeds a small report (phase 4). It can later re-rank `fastest` with real data
   instead of the courier's claim.
6. **Profit**: `courierCostPaise` against the shipping charged gives shipping margin per order
   (ties into the parked profit plan, `profit-build-plan`).

## Admin UI
Full pages and centred dialogs only, no right drawers. Card footer buttons sit on the right.
Copy in `apps/admin/src/data/delivery-options.ts` + `data/hi/`.

- **Apps → Delivery options** (`/apps/delivery-options`), full page:
  - **Couriers** card: each connected courier app with a status chip (Connected / Error / Not
    connected → link to its Connect page) and what it can give at checkout (Serviceability ·
    ETA · Live price · COD), from the table above via the adapter's capabilities. Health line:
    last error, % backup in 24 h.
  - **Delivery options** card: table (name, couriers, price, COD, conditions summary), drag to
    reorder, row → edit page, "Add option" → page. Empty state offers two presets: "Standard +
    Express from my couriers" and "Keep my current rates, add courier dates only".
  - **Rules** card: ordered list with a one-line summary each ("If PIN in *North-East list* and
    items tagged *bulky* → hide Express"), toggle on/off, drag to reorder. Add or edit opens a
    **dialog** with a condition builder (rows: field · operator · value) and an action list.
  - **Try a PIN** card: PIN, cart value or weight, optional product picker, COD toggle → shows
    the cards exactly as checkout would, plus the trace (which courier answered in how many ms,
    from cache or live, which rules fired). Reuses `settings/shipping-try-pin.tsx`.
- **Option page** (`/apps/delivery-options/options/[id]`, new at `/new`): cards for Name and
  display · Couriers and services (priority list, pick strategy) · Price (flat, zone, courier +
  markup, rounding, free above, backup price) · Arrival (courier TAT or fixed, buffer, cut-off,
  processing days) · Cash on delivery · Availability (conditions). Save bar like the zone page.
- **PIN lists**: a dialog from the rule builder ("Manage lists"). Paste or upload CSV, and see
  the count and invalid lines.
- Settings → Shipping keeps zones and rates, with one line: "Delivery options app is on: checkout
  options come from it; these rates are its backup."

## Phased build plan
Each phase is a PR into `dev`, verified at the end (lint, test, build).

**P1: Courier-backed options with zone prices (M)**
- `delivery_option` table. Engine: options backed by services; serviceability, COD and ETA from
  all backing couriers in parallel with an 800 ms deadline. Price `flat` or `zone` only.
- Checkout cards with real per-option dates and COD lines. Backup path as today's zone rates.
- Snapshot on the order (option, courier, service, promised dates). Create shipment preselects
  the checkout courier.
- App page: Couriers card, options list and page, Try a PIN.
- Result for Waimers: "Standard (Free, 4–6 days)" + "Express (₹99, 1–2 days, prepaid only)"
  with real Delhivery or Shiprocket dates.

**P2: Courier-priced options (M)**
- `courier` price (cost + markup, rounding, free above, caps, backup price), price cache by
  weight slab, stale-while-revalidate, circuit breaker, quote snapshot read by `placeOrder`.
- Health line and "placed on backup" marker. Shipping margin on the order.

**P3: Rules (M–L)**
- `delivery_rule` + `pin_list` tables, condition builder dialog, all conditions and actions
  above, trace in Try a PIN, cart free-shipping hint from the app.
- Import: the owner's Waimers Shopify rules recreated as rules (by hand or with a small mapper
  if they come as a list).

**P4: Same promise everywhere + learning (S–M)**
- Product page and cart use the engine for "Get it by Fri", so the date matches checkout.
- Promised vs delivered report per courier and option. Optional "fastest by real data".
- Nightly warm cache for top PINs. Shipments "To book" sorted by promise and cut-off.

## Open questions for the owner
1. **Your Waimers Shopify rules:** please share them (screenshots or an export of the app's
   rules, and which app it was). P3 will recreate them and make sure the model covers each one.
2. **Card names:** speed names only ("Standard", "Express"), or also the courier ("Express ·
   Blue Dart")? The default proposed here is speed names only.
3. **Express pricing:** a fixed price (e.g. ₹99), or courier cost + markup? And should Express
   ever be free above a cart value?
4. **COD with Express or same day:** allowed when the courier supports it, or prepaid only?
5. **Same day / next day:** do you want them at launch, and for which cities and cut-off times?
   They need a courier that offers them (Shadowfax, Delhivery same-day, or a Shiprocket hyperlocal
   partner).
6. **Courier down:** show only Standard at the backup price (proposed), or keep Express with
   the store's default dates?
