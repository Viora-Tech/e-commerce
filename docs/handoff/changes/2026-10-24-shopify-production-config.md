# Shopify: production app config

- `integrations/shopify/shopify.app.production.toml`: the live Koomerce Migration app (Kuldeep
  Partner org, client id `75f45ddb…`, public distribution) with production hosts and
  `read_all_orders` (granted 2026-10-24).
- Push it with `shopify app deploy --config production` from `integrations/shopify`. The Dev
  Dashboard form cannot set webhooks, so this is how the compliance webhooks and
  `app/uninstalled` get registered (needed before App Store review).
- Protected customer data: step 1 (data use, name/email/phone/address) is saved as a draft in
  Partners; step 2 (16 data protection questions) is the owner's.
- Deployed as `koomerce-migration-3` (2026-10-24) with the three compliance webhooks only:
  the CLI refuses an app-level `app/uninstalled` subscription while
  `use_legacy_install_flow = true`. Follow-up: register `app/uninstalled` per shop after install
  (GraphQL `webhookSubscriptionCreate`), or move to Shopify managed installation.
