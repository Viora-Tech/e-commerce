# Imported theme footer shows the store's policy links

Branch `fix/theme-shop-policies`. No migration.

- **Cause.** The Liquid `shop` global (`theme-import/page-context.ts`) set `shop.policies` to an
  empty list, so a Shopify footer's `{% for policy in shop.policies %}` row (Privacy policy ·
  Refund policy · Terms of service · Contact information · Shipping policy) rendered nothing on
  imported themes (seen on waimers.koomerce.app vs waimers.in). `shop.privacy_policy` etc. were
  hard-coded objects even when the policy was not published, so a theme reading them linked a 404.
- **Fix.** `storeLiquidData` (`theme-import/data.ts`) loads the published policies with
  `publishedPolicyLinks` (Settings → Policies; the pages with handles `privacy-policy`...) onto
  `LiquidShopData.policies`. `shopPolicies()` in `page-context.ts` turns them into Shopify's
  `policy` objects (`id`, `title`, `url` = our `/policies/<type>` page): `shop.policies` in
  footer order, and `shop.privacy_policy`, `refund_policy`, `shipping_policy`,
  `terms_of_service`, `contact_information` each the published policy or nil.
- `powered_by_link` stays blank (Shopify prints "Powered by Shopify"; our storefront shows no
  platform credit).
- `link_to` (`theme-import/filters.ts`) now prints named attributes like Shopify
  (`{{ shop.name | link_to: routes.root_url, class: 'x' }}` → `<a class="x" href="/">`); it used
  to print them as `title="class,x"`.
- Tests: `packages/core/src/theme-import/shop-policies.test.ts`.
