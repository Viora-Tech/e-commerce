# Affiliates › Settings › Portal address: connect affiliate.<domain> inside the app

Branch `feat/affiliate-portal-domain` (from `origin/dev`). No migration.

## What changed

- Owner, 27 Nov: connecting the portal's own address belongs in the Affiliates app, not in
  Settings › Domains. New **Portal address** card on Affiliates › Settings (second card, under
  Program):
  - shows where affiliates go now (`https://<primary domain>/affiliate`, or the portal host once
    live) with a copy button;
  - **Use affiliate.<primary domain>** connects that host (not primary, no redirect, no www
    twin) through the same domain service as Settings › Domains;
  - then the **DNS records** table from the Domains page (`DnsRecordsCard`: `CNAME affiliate`
    and `TXT _waimers-verify.affiliate`, plus any Cloudflare validation records), **Verify**,
    the same status chip (`DomainStatusBadge`) and the reason when it failed (held elsewhere, the
    provider's error). It re-checks every 10 s while pending, like the domain page;
  - when live: "Affiliates now use https://affiliate.<domain>", copy, and **Disconnect** (confirm
    dialog, then the existing `removeDomain`); a link to the domain's own page in Settings;
  - with no custom primary domain: "Connect your own domain first" with a link to Settings ›
    Domains. Without both grants (below) the card says Domains access is needed.
- **API** `affiliates.portalDomain.{get,connect,verify,remove}`
  (`packages/api/src/routers/affiliates-portal-domain.ts`, mounted in `affiliates.ts`). The
  server works out the hostname itself (the client sends nothing), so these calls can only ever
  touch `affiliate.<primary custom domain>`. Grants: `get` needs `marketing.read` + `settings.read`;
  the others `marketing.write` + `settings.manage` (the Domains page's grant), declared with
  `can(permission, also)`. The Affiliates app must be installed (`PRECONDITION_FAILED`).
- **Shared domain wiring** moved out of `routers/domains.ts` into
  `packages/api/src/services/domains.service.ts` (`domainTargets`, `toDomainView`,
  `connectStoreDomain`, `verifyStoreDomain`, `domainErrorsToBadRequest`); `domains.ts` uses it,
  behaviour unchanged.
- **Pre-fill rules** (pure, browser-safe) in `packages/core/src/domains/portal.ts`, exported from
  `@commerce/core/domains`: `portalHostname` (`www.waimers.in` → `affiliate.waimers.in`; null
  while the primary is the platform address), `portalFallbackUrl`, `findPortalDomain`. Same rule
  as the storefront's `portalHostFor` in `apps/storefront/src/lib/portal-routing.ts`.
- Admin: `components/apps/affiliates/portal-address-card.tsx`, `portal-address-status.tsx`;
  copy `data/affiliate-portal-domain.ts` + `data/hi/affiliate-portal-domain.ts`.

## Tests

- `packages/core/src/domains/portal.test.ts`: pre-fill (www dropped, platform primary gives
  nothing, fallback URL, finding the row).
- `packages/api/test/affiliates-portal-domain.test.ts`: connect → records → shows in
  `domains.list` → connect again is a no-op → verify (dev provider) → remove; no custom domain;
  the two-grant rule (marketing only, settings only, both); app not installed.
- `cross-store-leak.test.ts`: `affiliates.portalDomain.connect` / `verify` skipped like
  `domains.connect` / `verify`.

## Left to do / for the owner to check

- On localhost: Affiliates › Settings with waimers' primary `www.waimers.in`: the card offers
  `affiliate.waimers.in`; connect, see the two records; Disconnect removes the row.
- If the primary domain changes later, the card looks for `affiliate.<new primary>`; an older
  `affiliate.<old>` row stays in Settings › Domains and is removed there.
