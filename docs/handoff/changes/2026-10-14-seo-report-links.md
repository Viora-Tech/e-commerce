# SEO report, part 2: links, collections, categories, pages

New checks in Online store → SEO, from the store's own data with no crawling:
- **Broken internal links (medium).** A link inside product, collection or page text, or a menu entry, points at a
  product, collection or page that is not live and has no redirect.
  - Internal means a relative path, or an absolute URL on one of the store's domains (`store_domain`).
  - Paths are normalised: no query, hash or trailing slash, lower case, `/collections/x/products/y` read as
    `/products/y`.
  - Built-ins (`/collections/all`) and anything that isn't a product, collection or page path (blogs, policies,
    search) are not checked.
- **Links to the old Shopify store (medium):** absolute links to `*.myshopify.com`, a migration leftover that breaks
  when the Shopify store closes.
- **Empty collection (medium):** no active products.
- **No collection image (low).**
- **No product category (low):** used by Google Shopping.
- **Thin page (low):** a published page under 80 words.

Menu issues appear as resource "Menu", and their Edit link opens that menu.

**Files:**
- `packages/core/src/seo/links.ts` (pure) and `links.test.ts`.
- `checks.ts` takes an optional `SeoLinkContext` (known paths, store hosts, menu links).
- `service.ts` builds the context: live handles, redirects, domains, all menus.

Tests written, run on dev after merge. Stacked on `feat/seo-report`.
