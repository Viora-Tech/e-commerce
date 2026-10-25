# Store subdomains on the shared parent domain (2026-10-11)

`PLATFORM_STORE_DOMAIN=vioratech.in` makes store addresses `<slug>.vioratech.in`, the same parent as our own hosts.

- Reserved slugs: infra and tool hostnames (worker, dokploy, panel, maus, umami, ns1, admin-new, cdn2, l, ...) added to `RESERVED_STORE_SLUGS`, with tests.
- `PLATFORM_EMAIL_NAME` now defaults to `siteConfig.brand.name` (was `Waimers`); env example and email docs updated.
- New store address is registered with Dokploy automatically: `createStore({ requestPlatformRoute })` (set by the onboarding router when the Dokploy keys exist) queues the existing `domain.route_requested` outbox event; `runDomainRouteJob` now also handles `kind = 'platform'` rows for `<one-label>.<PLATFORM_STORE_DOMAIN>` (route guard gained `storeDomain`, passed by the worker), then sets route `ready` and SSL `active`. Idempotent, retried, never blocks store creation. The domain page already shows "Getting your security certificate" while SSL is `issuing`.
- Ops: add a wildcard `*` A record for the store domain at the proxy server.
- Not built: switching an existing store's primary address after `PLATFORM_STORE_DOMAIN` changes (Settings → Domains can only connect custom domains; nothing adds a new platform address row to an existing store, so existing stores keep their old-domain address).
- No migration.
