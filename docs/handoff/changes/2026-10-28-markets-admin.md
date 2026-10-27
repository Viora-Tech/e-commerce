# Settings → Markets (admin, API, core)

The admin side of Markets on the 0177 schema (`market`, `market_region`). No migration.

## Core: `packages/core/src/markets/`
- `service.ts`: `listMarkets` (primary first, then A to Z, with countries and the own
  domain's hostname), `getMarket`, `createMarket`, `updateMarket`, `setMarketEnabled`,
  `deleteMarket`, `ensurePrimaryMarket`, `MarketError` (`MARKET_NOT_FOUND` / `_INVALID` /
  `_CONFLICT`). It checks what the database cannot:
  - ISO country codes, and a country in one market only. The error names the market that has
    it ("Saudi Arabia is already in the Gulf market").
  - A real ISO 4217 currency (`Intl.supportedValuesOf`).
  - Subfolder format (`ae`, `en-us`) and uniqueness. A market's addresses on the main domain
    must not clash: its subfolder and `<lang>-<subfolder>` for each of its languages (`/ae`,
    `/en-ae`, `/ar-ae`), and `/<lang>` for the primary market's languages (`/hi`). Clashes are
    refused in both directions.
  - One way in: a subfolder or a domain, not both. The domain must be one of the store's own
    `active` domains (read under RLS), not the main one, not a redirect, and no other market's.
    It is only checked when it changes, so a domain that fails later does not block a rename.
  - The primary market (India) keeps its country, currency and prices, never takes a subfolder
    or a domain, and cannot be turned off or deleted. Only its name and languages change.
  - Deleting a market that has orders (`order.market_id`) turns it off instead.
- `client.ts` (pure, `@commerce/core/markets`): `COUNTRY_CODES` (249), `MARKET_CURRENCIES`,
  `MARKET_LANGUAGES`, `SUBFOLDER_PATTERN`, `marketPaths`, `pathClash`, `suggestSubfolder`,
  `currencyForCountry`. The service and the admin dialog use the same clash rule.
- Primary market for new stores: 0177 only seeded stores that existed then. `createStore` now
  calls `ensurePrimaryMarket`. `listMarkets` and `createMarket` call it too, so a store created
  between 0177 and this change gets its India market the first time Markets opens.

## API
- `markets` router (`list`, `get`, `create`, `update`, `setEnabled`, `delete`), behind
  `settings.read` / `settings.manage`. A `MarketError` becomes 404 / 400 / 409 with its message.
- MCP: `markets` maps to the settings area. `markets.delete` is sensitive by its name. The
  action docs are regenerated.

## Admin: Settings → Markets (`/settings/markets`, under Selling)
- List: name with how shoppers reach it (`waimers.koomerce.app/ae`, its own domain, or
  "Shopper's choice"), the first three country codes "and N more", currency, languages, and an
  on/off switch (the primary market's is always on). The ⋯ menu has Edit and Delete. When only
  India exists, an empty state explains markets and offers "Add market".
- Add and edit open a dialog, not a drawer. It holds: name; a searchable country checklist
  (countries in another market are disabled and name that market); currency (the 21 offered);
  default and extra languages (19); how shoppers reach it (a subfolder suggested from the
  first country and editable, a connected domain, or none); price adjustment (%) with
  rounding; an optional fixed rate ("1 INR = … AED"); and duties (DAP or DDP). The currency
  and subfolder follow the first country until the merchant picks them. The primary market's
  dialog shows only name and languages, with a note that India's country and currency are fixed.
- English and Hindi copy: `data/markets.ts`, `data/hi/markets.ts`. Also added: the Hindi page
  name, the page title, a settings search entry and an `Earth` icon (`packages/ui` icons-more).

## Tests
- core `markets/client.test.ts` (4) and `markets/service.test.ts` (9): the primary market,
  countries, subfolders and language addresses, domains, primary protections, moving
  countries, delete or turn off, store isolation. Onboarding tests (39) still pass.
- api `markets.test.ts` (2): the full flow and the error statuses. MCP catalogue tests pass.
- admin `market-dialog.test.tsx` (3): the first country fills the currency and subfolder, a
  taken country and a clashing address are refused, and the primary market's dialog sends only
  its name and languages. The admin suite passes (101 files).
- Sweeps: `market-schema.ts` names now imported here (`MARKET_ROUNDING`, `MARKET_DUTIES`,
  `marketRegion`) are off the no-orphans list. `data/settings-search.ts` went past 500 lines
  with the Markets entry, so it is on the file-size list (a flat index: split it by settings
  group when it next changes).
- Cross-store leak test: since 0177 its seeder could not fill `market`, `market_region` or
  `translation` (pattern checks), so it failed on dev before walking anything. `seedEveryTable`
  now gives those columns ISO-shaped values, and gives `order.number` unique values (`order
  (store_id, number)` is unique since 0177, and every order-creating procedure collided with
  seeded order #1). `markets` is mapped to `market` in the walk. No leaks are found. The 60%
  coverage floor still sits right at the edge (443 to 447 of 741 procedures answer, and the
  floor needs 445), so it can still fail now and then. That comes from randomness elsewhere in
  the walk, not from this change: Markets adds 6 procedures, and 4 of them answer.

## Not done
- The storefront side (routing `/<subfolder>` and market domains, price conversion, the
  country selector) is built separately. A daily reference-rate job does not exist yet, so a
  market with no fixed rate has no rate until one lands.
