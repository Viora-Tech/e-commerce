# Email templates exempt from the storefront cache check

`marketing_email_template` (added in 0142_email_design, #638) has a `store_id` but was not classified, so the db test `storefront cache triggers > classifies every table` failed. Email templates are admin-only and never render on the storefront, so the table is listed in `STOREFRONT_CACHE_EXEMPT` as `ADMIN` in `packages/db/src/storefront-cache.ts`. No migration needed.
