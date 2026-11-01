# Market page, Shopify style (30 Oct 2026)

- Each market has its own page, `/markets/<id>` (`components/markets/market-page.tsx`): header
  with Active/Off and Primary chips, Rename and Delete in its menu, the on/off switch in the side
  column, and a Settings card with one row per setting and its value now: Countries, Currency
  and prices, Import duties, Languages, Address, Products and catalog, Shipping, Online store
  theme, Policies. A row opens just its part of the market dialog (`MarketDialog part`), or the
  admin page that owns it. Catalogs are not built yet; that row says so and is not clickable.
- The Markets list's names link to these pages; Add market opens the new market's page after
  saving.
- No data change: markets already had `enabled`.
