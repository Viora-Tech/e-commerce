# Liquid `customer` for imported themes

- Imported Shopify themes now get a real `customer` drop when a shopper is signed in (id, email,
  first/last name, name, phone, orders_count, total_spent in hundredths, tags,
  accepts_marketing, has_account, addresses_count, default_address); nil signed out.
  Loaded in one query (`theme-import/customer-data.ts`), wired like `cart`.
- Cache safety: every read of the `customer` global is traced (`onCustomer`, `render.ts`
  `renderGlobals`). A render that read it while signed in is never cached; one that read it as
  nil is cached but served only to signed-out shoppers; renders that never read it stay shared
  (`liquid-cache.ts` `servable` / `keepable`). Predictive-search section HTML is
  `private, no-store` for a signed-in shopper. Tests: `liquid-customer-cache.test.ts`.
