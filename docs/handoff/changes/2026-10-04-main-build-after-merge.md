# Main builds again after #238–#241 (2026-10-04)

Merging #241, #238, #239 and #240 together left `main` failing to build (tests were green):

- **Importer vs new reference fields.** CMS PR2 (#239) added `page_reference`, `variant_reference`
  and `article_reference` to `REFERENCE_TYPES`; the Shopify importer (#240) still keyed its maps on
  the old four kinds, so the admin and storefront type checks failed.
  `packages/plugin-shopify-import/src/references.ts` now resolves page and blog post links through
  the `pages` / `articles` import mappings; variant links count as missing (variants are not
  mapped one by one yet). `field-values.ts` has words for the three new kinds.
- **Docs build.** Two MDX pages broke the Nextra compile: an inline code span split across lines in
  `developer-docs/building/admin-languages.mdx`, and a bare `<name>` in a table cell in
  `developer-docs/building/shopify-theme-import.mdx`.

- **Admin build without env.** `apps/admin/src/app/api/auth/[...all]/route.ts` called `auth()` at
  import, so `next build` (which imports every route) needed DATABASE_URL, REDIS_URL and
  AUTH_SECRET. The Docker build has none, so the admin image could never build. The Better Auth
  handlers are now created on the first request.

Verified on the merged tree: lint, sweeps, full `bun run test`, typecheck, and builds of admin,
storefront, worker and docs. No migration. Follow-up still open: map Shopify money, rating, measurement and reference
metafields onto the new CMS field types in the importer (`field-plans.ts`).
