# Koomerce App Platform — roadmap (not started)

Agreed 2026-10-21: built-in "Koomerce apps" (Search, Inbox, GST, …) stay in the codebase; third-party apps live on a separate App Store site and connect from outside, Shopify-style. Start a few weeks after the Waimers launch, after Inbox v1. Brainstorm a full design before building.

| Part | Exists today | Missing | Rough size |
|---|---|---|---|
| Public API | oRPC admin API with per-action permissions | Scoped access tokens (`read_orders`…), rate limits, versioned surface (`/2026-11/…`), generated docs | ~1 week |
| Webhooks | Outbox events (`order.paid`, …) | Per-app subscriptions, HMAC-signed delivery, retries, delivery log | 3–4 days |
| OAuth install | better-auth sessions | Consent screen, app registration, token issue/revoke, uninstall | ~1 week |
| App Store site (`apps.koomerce.app`) | `apps/www` app list | Listing pages, search, Install → store admin, developer submission + review | 3–5 days |
| Embedded admin pages | — | App page in an iframe inside admin with a signed session token | ~1 week |
| Theme app blocks | Built-in apps already add storefront blocks | Blocks supplied by external apps | ~1 week |
| Checkout extensions | — | Later; highest risk | later |

## Order

1. Private apps: merchant creates an API token + webhook subscriptions in Settings (agencies, Zapier-style tools). Foundation for the rest.
2. OAuth install, App Store site, embedded admin pages.
3. Theme blocks from apps, checkout extensions, developer payouts.

## Hard parts (not the code)

- Security: strict per-store scopes, revocable tokens, app review before listing.
- API stability: versioned; no breaking changes once third parties build on it.
- Supply: the first 5–10 apps on the store are ours, built on the platform.
