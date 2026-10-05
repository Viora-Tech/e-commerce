# Real custom-domain check: `DOMAIN_PROVIDER=dns` (2026-10-05)

Branch `feat/real-domain-check`. No migration.

Custom domains never went live on a server: the only provider was `dev`, which leaves every
real domain `pending`, and the storefront only routes `status = 'active'` rows. New provider
`dns` (`packages/core/src/domains/dns-provider.ts`, registered in `DOMAIN_PROVIDERS` /
`createDomainProvider`, `DOMAIN_PROVIDER` enum in `packages/config/src/env.ts`; `dev` stays the
default):

- Apex: A records must include `STOREFRONT_A_RECORD`. Subdomain: CNAME equals
  `STOREFRONT_CNAME_TARGET` (case / trailing dot ignored) or an A record equals
  `STOREFRONT_A_RECORD` (flattened CNAME, Cloudflare DNS-only). All A records in Cloudflare's
  ranges (orange cloud): routing counts only when the TXT matches, noted in `error`.
- TXT `_waimers-verify[.name]` must hold the token. Missing records → `pending`; records pointing
  elsewhere or another token → `misconfigured` (row `failed`) with a plain-words error.
- DNS right → TLS handshake to `host:443` (servername = host, trusted cert, 5 s): `active`, else
  `issuing`. Lookup timeout / server failure → previous state (new `previous` in
  `DomainCheckInput`, filled by `verifyDomain`), never a throw. `DomainCheckInput` also carries
  `targets` now.
- Resolver and TLS checker are injected; `dns-provider.test.ts` never touches the network.
- `loadEnv` refuses `DOMAIN_PROVIDER=dns` while `STOREFRONT_A_RECORD` is the documentation default.
- Worker poll and admin verify were already wired (`verifyDomain` flips to `active` on verified
  DNS; `{domains}-verify` repeat job every 2 min). Unchanged.

To turn on (admin + worker env): `DOMAIN_PROVIDER=dns`, `STOREFRONT_A_RECORD=<server IPv4>`,
`STOREFRONT_CNAME_TARGET=<hostname resolving to it>`. Live probe on 2026-10-05: kuldeepsaini.com
(Cloudflare-proxied, TXT present) comes back verified + SSL active.

Not done / follow-ups:
- Each live hostname still needs an HTTPS route on the proxy (Dokploy domain on the storefront
  app). Manual; automating it (Traefik on-demand TLS or the Dokploy API) is a separate build.
- `failed` domains are not polled (`stores_with_pending_domains()` skips them); the merchant
  presses "Verify connection" after fixing records. Re-polling them needs a migration.
- No AAAA check: a stray IPv6 record at the old host blocks Let's Encrypt; documented only.

Docs: `apps/docs/content/developer-docs/building/custom-domains.mdx` (new), deployment
"Merchants' own domains", `.env.example`, `deploy/env.production.example`.
