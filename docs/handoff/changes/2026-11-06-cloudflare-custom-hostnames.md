# Cloudflare for SaaS custom hostnames (2026-11-06)

Branch `feat/cloudflare-custom-hostnames`, issue #1177. Migration `0223_store_domain_edge_records`.
Nothing is deployed, and `DOMAIN_PROVIDER` stays `dev` by default, so `dev` and `dns` behave as
before. The rollout steps are in developer docs, Custom domains, "Rolling out Cloudflare for SaaS".

A merchant domain could read Connected on a padlock alone while another host served it, and a
direct A record skipped Cloudflare. `DOMAIN_PROVIDER=cloudflare` puts subdomains on Cloudflare for
SaaS and makes an apex redirect-only.

- **Client** `packages/core/src/domains/cloudflare.ts`: find, create, refresh, remove on the custom
  hostnames API. Fetch is injected; the token goes only in the `Authorization` header; Cloudflare's
  error text is never echoed. Request and response shapes were checked against
  developers.cloudflare.com, not against a live account.
- **Provider** `cloudflare-provider.ts`: a subdomain is verified only when Cloudflare says `active`,
  a CNAME reaches `STOREFRONT_CNAME_TARGET`, and our `_waimers-verify` TXT is there. A direct A record
  is refused. The certificate is `active` only when Cloudflare says so and the Traefik route is
  `ready`, because the tunnel ends at Traefik. A failed API call or lookup keeps the previous state.
  `blocked` states give the merchant one instruction (`DOMAIN_HELD_ERROR`, `heldElsewhere` on the
  view, translated) and ask Cloudflare again on each press of Verify connection.
- **Billing guard**: a hostname is created only once our TXT is seen, not at connect, so nobody can
  run up the bill with names they do not own. `edge_records` is null until then.
- **Apex**: `dns` rules, no Cloudflare call, a proxied apex does not count. Its Dokploy route carries
  `apex-to-www@file`. Connecting an apex brings its www; a www held by another store refuses the
  connect. `domains.setPrimary` refuses an apex. An apex already primary keeps serving, unmigrated.
- **Dokploy**: `middlewares` on `domain.create` needs 0.29.0 (checked in Dokploy's tagged sources).
  Older releases drop it silently, so `createDomain` checks the answer, deletes the domain and fails.
  `ensureRoute` replaces an apex route lacking the middleware.
- **Sweep**: scheduled unless `dev`, for the apex's Let's Encrypt certificate. `checkCertificate`
  skips a row with `edge_records` set, or its handshake would mark it active on a padlock again.
  **Retry certificate** is refused and hidden there; Verify connection does that job.
- **Removal**: `domain.route_removed` now also fires for a row at Cloudflare, and its job deletes the
  custom hostname, otherwise it stays claimed on our zone.
- **Admin**: a live row Cloudflare has not confirmed shows why and no longer toasts "Domain
  connected". The connect dialog says the www comes with an apex. EN + HI copy
  (`domainEdgeContent`).
- **Env**: `CLOUDFLARE_ZONE_ID` (shared), `CLOUDFLARE_API_TOKEN` (admin and worker blocks in compose,
  `NOT_FOR_APPS` in the sweep, like the Dokploy key). `loadEnv` refuses a missing zone or default
  targets. It cannot refuse a missing token, because the storefront loads the same schema and must
  not hold it, so `createDomainProvider` does and the worker will not start.
- `reviewerSignIn` and `merchantGoogleSignIn` moved to `packages/config/src/env-sign-in.ts`
  (re-exported) to keep `env.ts` inside its file-size limit.

**Design gaps, also in the docs and PR:**

- An apex A record needs 80 and 443 open to everyone, so the origin cannot be closed while the apex
  redirect shares its address. Closing it needs a separate small redirect host, not built.
- Cloudflare's docs do not say what happens when two SaaS providers hold one exact hostname. If it
  reports `active` for us while the other keeps the traffic, this provider says Connected. Test this
  on the real account first; a storefront-only response check is the follow-up if it happens.
- The cut-over is not zero downtime: a route is added only after the CNAME moves, so a live store
  can answer 404 for a few minutes.
