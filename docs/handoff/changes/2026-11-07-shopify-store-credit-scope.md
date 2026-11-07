# Shopify app asks for store credit (2026-11-07)

- `read_store_credit_accounts` added to `ALL_SCOPE_HANDLES` (optional), the admin scope names
  (English and Hindi) and both `shopify.app*.toml` files. `read_reports` added to the toml files
  too, which had fallen behind `ALL_SCOPE_HANDLES`.
- Nothing reads store credit yet; this is so one reinstall of the Koomerce app on Waimers grants
  it ahead of the store credit import (issue #1227, store credit step 5).
- After merge: `shopify app deploy` from `integrations/shopify` (production config), then
  reinstall the app on the store.
