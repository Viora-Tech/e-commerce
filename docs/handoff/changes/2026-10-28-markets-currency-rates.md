# Markets M1a: reference exchange rates and the conversion rule

First step of prices in a market's currency (plan: M1a rates and rules → M1b imported themes'
money filters and cart JSON → M1c our own themes, cart drawer and checkout). Nothing a shopper
sees changes yet. No migration (0177 made `exchange_rate`).

## Rates (`packages/core/src/markets/rates.ts`, worker `apps/worker/src/fx-rates.ts`)
- Daily job `{fx}-rates` at 21:30 India time, once for the platform, and once when the worker
  starts: reads the ECB's euro reference rates
  (`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`, free, no key) and keeps them
  as units per rupee in `exchange_rate` (`base INR`, `source ecb`, one row per currency and day;
  a second run the same day changes nothing).
- Not published by the ECB, derived exactly: AED, SAR, QAR, OMR, BHD through their fixed US
  dollar rates; NPR at 1.6 per rupee.
- Not covered: KWD, LKR, BDT. A market in one of these needs a fixed rate (Settings → Markets)
  until another source is added; without one its shoppers keep seeing rupees.
- `latestRupeeRates(tx, currencies)`, `storeMarketPricing(tx)` (each market's pricing by id).

## The rule (`packages/core/src/markets/presentment.ts`, browser safe via `@commerce/core/markets`)
- `marketPricing(market, referenceRate)`: the market's fixed rate, else the reference rate;
  null when neither exists. A rupee market converts at 1.
- `presentmentMinor(paise, pricing)`: rupees × rate × (1 + adjustment), then rounding, in whole
  minor units of the currency: `none` to the minor unit, `whole` to the nearest whole unit,
  `x99` up to the next .99 (.990 for dinars; the next whole yen). Signs kept for discounts.

## Money (`@commerce/money`)
- `CURRENCIES` now holds the 21 market currencies with their ISO decimals (KWD/OMR/BHD 3, JPY 0)
  and a default locale; `isCurrency(code)`.
- Metaobject money fields stay on INR, USD and EUR (`FIELD_CURRENCIES` is now that fixed list,
  `FieldCurrency` its type), so the field editor's choices did not grow with the market list.

Tests: core `markets/presentment.test.ts` (10), `markets/rates.test.ts` (6, ECB file, pegs,
one row per day, failures, latest rate, each market's pricing); money format (market
currencies); core metaobjects; sweeps (26 files). Typecheck: core, money, worker, admin,
storefront.
