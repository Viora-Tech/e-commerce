# SEO defaults that work for every store (22 Nov 2026)

Merchants rarely tune SEO by hand, so the storefront now fills the gaps itself.

- **Product breadcrumb.** The product's BreadcrumbList JSON-LD is Home > collection > product.
  The collection is the brand's own when one is titled like the product's vendor (any case),
  else the first non-catch-all active collection by title (`breadcrumbCollection` in
  `packages/core/src/theme-import/product-fields.ts`). The visible breadcrumb in `ProductView`
  uses the same pick. `loadProductPageExtras` takes the vendor as an optional third argument;
  `apps/storefront-hono` still calls it without one (old behaviour, no brand match).
- **Organization JSON-LD.** It already had `logo` (theme logo); it now has `sameAs` from Theme
  settings › Social media (`socialProfiles`, WhatsApp left out as a chat link, not a profile).
- **robots.txt.** `/*?*sort=` is no longer disallowed: sorted and filtered views already carry
  `noindex, follow`, which Google can only read when it may crawl them.
- **Collection meta description.** Own SEO description, else body text, else written:
  "Shop ATK at Waimers: ATK X1, ATK Blazing Sky, ATK Z2 and more." (`seoContent.autoDescription`,
  first three products in the collection's saved order, `collectionLeadTitles`). It never falls
  back to the store-wide description. No Hindi overlay: the storefront has no `data/hi/`.
- **Collection JSON-LD description.** Falls back to the body as plain text.
- **Product meta description.** Own SEO description, else the prose of the body
  (`seoProse`, new in `@commerce/core/catalog`), else "Buy X1 by ATK at Waimers, from ₹4,999."
  (the brand is dropped when it is the store's own name). The JSON-LD description still uses
  `seoSnippet` (body words, spec rows included).
- **Image alt text.** Product images whose saved alt is an empty string now fall back to the
  product title (`??` became `||` in the product card, gallery, lightbox, Zero Drift drop reveal,
  featured carousel, latest drop, image comparison, hero slide, predictive and recommendations
  JSON, Open Graph images). The collection banner's alt is the collection title. Collection
  cards keep `alt=""`: the title is the link text beside the image.
- **Sitemap.** Not changed: products and collections have no "hidden from search" flag (only
  variants have `hidden_on_store`). Adding one would be a schema change and an admin control.
