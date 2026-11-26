# Release candidate 27 Nov: five branches combined, two small fixes on top

Branch `release/nov27` (from `origin/dev` 0c5070c27). Not pushed. No migration (none of the five
branches adds one; the last journal entry is unchanged).

## Merged (`git merge --no-ff`, in this order, no conflicts)

1. `feat/back-in-stock-essential`: back in stock rebuilt in Essential's layout
   (`2026-11-26-back-in-stock-essential.md`).
2. `feat/consent-like-shopify`: cookie banner only where consent is required
   (`2026-11-26-consent-like-shopify.md`).
3. `fix/round3-domains-media`: one-hop apex redirect, twin redirect, bare-domain guide, missing
   video media (`2026-11-26-round3-domains-media.md`).
4. `fix/phone-layout`: storefront phone layout fixes (`2026-11-26-phone-layout.md`).
5. `fix/portal-tab-gap`: affiliate portal tab gap (`2026-11-26-portal-tab-gap.md`). Its base is
   `origin/main`, so the merge also brings main's release merge commits; their content was
   already on dev.

Only file touched by two branches: `apps/storefront-hono/src/product-page.ts` (back in stock and
consent), different hunks, merged cleanly.

## Extra change 1: a failed region check shows no banner

- A page drawn `pending` (shared cache) learns the region from `/api/consent-region`. If that
  fails, answers non-2xx or an unknown value, or takes longer than 3 s, the visitor is now
  treated as `open` (no banner, tracking runs) instead of `ask`. The guess is not saved in
  `sessionStorage`, so the next page asks again.
- `REGION_FALLBACK` and `REGION_CHECK_TIMEOUT_MS` in `packages/core/src/online-store/consent.ts`;
  `fetchRegion` in `apps/storefront/src/lib/consent-region-client.ts`; the same rule in the
  plain-HTML island script (`apps/storefront/src/lib/plain-html/islands.ts`).
- Tests: `apps/storefront/src/lib/consent-region-client.test.ts` (new) and a case in
  `lib/plain-html/banner-modules.test.ts`.

## Extra change 2: COD & RTO "Medium" tab

- The Risky orders tab "Medium and high" is now "Medium" (Hindi "मध्यम") and lists only
  medium-risk orders. The filter key is renamed `risky` to `medium` (`RISK_ORDER_FILTERS` in
  `packages/core/src/cod-rto/settings.ts`, `filterWhere` in `overview.ts`, the API default in
  `packages/api/src/routers/cod-rto.ts`, the admin default tab). The verification setting
  "send to risky orders" (`sendTo: 'risky'`) is separate and unchanged.
- Merchant guide `apps/docs/content/merchant-guide/apps/cod-rto.mdx` updated.
- Test: "the Medium tab lists only medium-risk orders" in `packages/core/src/cod-rto/cod-rto.test.ts`
  (database-backed).

## Checks run here (27 Nov)

- Typecheck clean: core, api, blocks, plugin-back-in-stock, worker, storefront, storefront-hono,
  admin.
- Vitest passed: blocks 805, worker 92, storefront 811 (1 skipped), storefront-hono 8, admin 1333
  (after fixing `bare-domain-guide.test.tsx`, which rendered Hindi before `loadHindi()`).
- Not run: core, api, plugin-back-in-stock vitest (database-backed; Docker/Postgres was not
  running, ECONNREFUSED). Run them on dev, including the new COD & RTO "Medium tab" test.

## Left to do / for the owner to check

- On localhost: a cached page with `/api/consent-region` blocked shows no banner; COD & RTO ›
  Risky orders opens on "Medium" with no high-risk rows.
