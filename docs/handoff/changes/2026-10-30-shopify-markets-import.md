# Shopify import: markets (audit #114)

- Store settings import has a new **Markets** part (`settings-plan-markets.ts`). It reads Shopify markets (status, conditions, currency, web presence, catalog price adjustment) and creates them here with `createMarket`.
- Shopify **drafts come over switched off**. The market selling in the primary market's countries (India) is left as is. A market whose countries another market here already has is listed for the merchant (`market_country_taken`). Re-running changes nothing.
- New scope `read_markets` added to `ALL_SCOPE_HANDLES`, both `shopify.app*.toml` files and `integrations/SUBMISSION.md`. **Owner:** run `shopify app deploy` and send it for app review, then reconnect Waimers. Until then the part shows "Needs access".
- Not done yet (rest of the scope bundle, #75): purchase orders and transfers need API 2026-10 and the `read_inventory_purchase_orders` / `read_inventory_transfers` scopes. The bulk-ops code depends on 2025-07, so that bump is its own change.
- Tests: `packages/plugin-shopify-import/test/settings-plan.test.ts` › markets.
