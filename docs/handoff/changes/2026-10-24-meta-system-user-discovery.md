# Meta connect: find the business from a system user token

- Facebook Connect on production failed with `(#100) Missing Permission`: with a login
  configuration (`META_LOGIN_CONFIG_ID`) Meta returns a business integration **system user**
  token, and `/me/businesses` is refused for it.
- `metaDiscover` now reads the granted business from `debug_token` (granular scope
  `business_management` → `target_ids`), then `/{business}?fields=id,name`. User tokens (no login
  configuration) still use `/me/businesses`.
- Test: `packages/core/src/sales-channels/meta-discover.test.ts`.
