# "Built-in apps" are now "Koomerce apps"

Apps we build ourselves (`kind: 'builtin'`) are called Koomerce apps in the App Store, like
Shopify's own apps: made by us, run on the store, no account, keys or server to set up. The card
label said "Built by Waimers" (the old platform name); it now says "Koomerce app". English and Hindi
copy in `apps/admin/src/data/apps.ts`, `installed-apps.ts` and their `hi/` overlays. The S3 policy
statement ids shown to merchants are renamed from `Waimers…` to `Koomerce…` (names only; existing
policies keep working).

Direction: search, inbox (chat + email) and experiments are next as Koomerce apps, replacing the
Meilisearch, Chatwoot and GrowthBook connectors as the default (those stay as optional connections).
