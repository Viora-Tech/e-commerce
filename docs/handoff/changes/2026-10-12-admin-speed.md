# Admin speed: one identity lookup per request, a parallel shell, lazy Hindi (2026-10-12)

Owner report: admin.vioratech.in felt slow on signed-in pages. Measured on a production build
against a copy of the Waimers database. Server TTFB went from 107–157 ms to 32–41 ms. DB
statements per cold load dropped by about 60% (Home 249 → 100). First-load JS shrank by
160–210 kB gzip on every route. Full write-up, with the table and how to measure:
developer docs `building/admin-performance`.

- **Request memo** (`packages/api/src/procedures/request-memo.ts`, `ApiContext.memo`): within one
  request, the session, the membership and the member's grants are read once. The admin's
  `serverContext()` is now React-`cache()`d and seeds the memo from the cached `getSession()`.
  Nothing is kept across requests, so permissions are still checked on every request. Tests and
  scripts pass no memo and behave as before. Test: `packages/api/test/request-memo.test.ts`.
- **Membership in one query**: `organizationMembership()` in `packages/db/src/resolve-store.ts`
  reads the member role and the store id together. `findMembership` no longer calls Better
  Auth's `getFullOrganization`, which read the session again plus the org, invitations, members
  and users. One behaviour difference: a non-member's active organization is no longer
  cleared as a side effect. They still get "no store" and the picker.
- **Shell** (`app/(admin)/layout.tsx`): stores, apps, logo and storefront origin are read in
  parallel. They come from `lib/shell-data.ts` and the cached `storefrontOrigin()`, so Home and
  the order page reuse the layout's apps list. The logo uses the new `themes.logo` procedure
  instead of `themes.list`. Home starts its reads together with its `staff.me` guard.
- **`themes.templates.live`** replaces `themes.list` followed by `templates.list` in
  `TemplateSelectField` (product and collection pages).
- **Loading boundaries**: new `loading.tsx` files for settings, account (`SectionPageSkeleton`),
  content, growth, online-store, apps (`ListPageSkeleton`) and analytics (`DashboardSkeleton`).
  Navigating inside those sections used to hold the old page with no feedback.
- **Lazy Hindi**: `lib/copy.ts` starts empty. `lib/hindi.ts` `loadHindi()` imports `data/hi`
  on demand: `getLocale()` awaits it on the server and `LocaleProvider` suspends on it in the
  browser. Never import `@/data/hi` from components. Tests call `addTranslations(hindiCopy)`.
  Developer docs "Admin languages" are updated.
- No migration, no new env keys.
- Not done, measured:
  - `@commerce/ui/icons` ships about 106 kB gzip (all 160 icons, every weight) on every page.
    PURE annotations did not help under Turbopack. The fix is one file per icon.
  - Next's `unstable_dynamicOnHover` would make sidebar clicks skip the skeleton, but the
    prop is not in `next/link`'s public types.
  - The DB pool is `max: 10` per process. Home opens about 12 transactions at once.
  - Better Auth's 5-minute session cookie cache is never refreshed by server reads, so each
    request still reads `session` and `user` (now once, not 8–20 times).
