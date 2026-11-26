# One-hop apex redirect, twin redirect, bare-domain guide, missing media files

Branch `fix/round3-domains-media` (from `origin/dev`). Round 3 items 16, 17 and 18. No migration.

## What changed

- **16. One-hop apex redirect.** Dokploy puts only `redirect-to-https` on a domain's plain-http
  router, so `http://brand.in/a` took two hops (`https://brand.in/a`, then www). The route job
  (`runDomainRouteJob` in `packages/core/src/domains/routes.ts`) now, for a redirect-only apex,
  swaps that middleware for `apex-to-www@file` in the storefront app's Traefik file
  (`ensureOneHopApex` / `oneHopApexConfig` in `domains/one-hop-apex.ts`, via the new
  `readTraefikConfig` / `updateTraefikConfig` on the Dokploy client, `domains/dokploy.ts`). This is
  the hand fix done on live for waimers.in and clawgears.in, made automatic. Every later route job
  (re-register, certificate sweep) re-applies it. A failure is only logged; the apex then works
  in two hops as before. Developer docs: Custom domains, step 7.
- **16. Twin redirect for any store.** `setPrimaryDomain` (`domains/service.ts`) now also sets
  `redirect_to_primary` on the new primary's connected www/apex twin, so the twin sends visitors
  to the primary (one storefront 301, path kept) instead of serving a copy. Works both ways (www
  primary or apex primary). The merchant can switch it off on the twin's page.
- **17. Bare-domain guide.** Settings > Domains > Connect: typing a bare domain shows the two
  records it needs with this server's values (apex A record, www CNAME) and whether ALIAS / CNAME
  flattening is OK (not when the apex only redirects). `components/domains/bare-domain-guide.tsx`,
  copy `domainBareGuideContent` in `apps/admin/src/data/domains.ts` + Hindi. The targets come from
  the page (`STOREFRONT_A_RECORD`, `STOREFRONT_CNAME_TARGET`). The existing www twin checkbox stays.
- **18. Missing media.** The video copy/poster job (`compactVideo`, `apps/worker/src/video-compact.ts`;
  hourly `media-video-backfill` and `bun run media:videos`) now marks a video whose object is gone
  (`markMediaMissing` in `packages/core/src/media/compact-video.ts`: `compact_size` 0 and
  `process_error` = `MEDIA_MISSING_ERROR`) and returns `missing` instead of throwing. No sweep or
  plain run looks at it again; `--force` does, and clears the mark if the file is back.
  `getMedia` (`media/library.ts`) returns `missing`, and Content > Files > the file's page shows
  "File missing from storage" as its status with a hint (`media-file-page.tsx`, copy in
  `data/media.ts` + `data/hi/content-files.ts`). The row keeps its status, so it stays in Files.

## Tests

- Added `domains/one-hop-apex.test.ts` (pure): run here with `bun test`, 7 pass.
- Added `domains/twin-redirect.test.ts` (database), `dokploy.test.ts` (Traefik calls),
  `media/file-page.test.ts` (missing flag), `apps/worker/src/video-compact.test.ts` (missing,
  force clears), `apps/admin/src/components/domains/bare-domain-guide.test.tsx` (jsdom). **Not run**:
  the worktree has no `node_modules` (bun install needs the owner's OK). Typecheck not run either.

## Left to do / for the owner to check

- On the server: confirm Dokploy's `application.readTraefikConfig` / `updateTraefikConfig`
  answer as expected (API key), then `curl -I http://<apex>/a?b=1` gives one 301 to
  `https://www.<apex>/a?b=1`. The live hand fix on waimers.in / clawgears.in is compatible
  (the patch sees `apex-to-www@file` already there and writes nothing).
- With `DOMAIN_PROVIDER=dns` (no Traefik middleware) a twin redirect is still two hops over plain
  http (`redirect-to-https`, then the storefront 301). Making that one hop needs per-store Traefik
  middlewares; not built.
- Images whose object is missing are not covered: only the video sweep retried them hourly.
- A video in an older bucket (`provider` differs) returns `skipped` without a mark, so the hourly
  sweep can queue it again; not changed here.
