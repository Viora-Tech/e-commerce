# Store links use the store's primary domain, not STOREFRONT_URL

Branch `fix/store-links-use-primary-domain`. No migration (latest stays 0088).

**Bug:** on the test server every store-facing link was built from the one global
`STOREFRONT_URL` (`https://shop.vioratech.in`), which belongs to no store. One storefront serves
every store by hostname, so theme previews, "View store" and email links answered
"No store is configured for shop.vioratech.in." The store's real primary was kuldeepsaini.com.

**Fix:** one helper, `storefrontOriginFor(tx, storeId, fallback)` in
`packages/core/src/domains/origin.ts`. It returns `https://<primary hostname>` when the primary
domain is live (`is_primary AND status = 'active'`), else `fallback` (`STOREFRONT_URL`, origin
only). In dev, when `STOREFRONT_URL` is a localhost URL, it always returns the fallback.

Call sites:

- Admin: new `store.origin` procedure. It is a bare `storeProcedure`, so every member can call it,
  including staff without `settings.read` (added to docs/guardrails.md). It is read through
  `apps/admin/src/lib/storefront-origin.ts` by the layout ("View store"), themes list, import
  report, products new/edit, pages, blog posts new/edit, policies and Growth › Links.
- API: `marketingDeps` (campaign/automation shop, click and unsubscribe links and the setup's
  `storefrontUrl`), `sendRecovery`, `paymentTestOrderLink`, and the imported-theme editor
  canvas (`theme-import.service.ts`).
- Core and worker: `deliverNotification` (order and balance links), `deliverNewsletterConfirm`
  (now uses the helper), `storeAppContext` (apps' `ctx.storefrontUrl` for hooks, jobs and email
  links; `appContext` is now private), back-in-stock alerts, and the marketing worker deps.
- Storefront: the thank-you and account order pages hand apps the store origin.

`STOREFRONT_URL` is still read in each of these places, but only as the fallback. The env
comments say "fallback only". Docs: developer docs › Custom domains, "Store links use the
primary domain".

Tests: `packages/core/src/domains/origin.test.ts`, the new `storeAppContext` case in
`packages/core/src/plugins/events.test.ts`, and `packages/api/test/store-origin.test.ts` (owner
and staff get the primary domain; a pending primary falls back).
