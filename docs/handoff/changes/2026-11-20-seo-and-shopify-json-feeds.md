# Shopify-compatible product JSON for feeds, Shopify child sitemaps, SEO fixes

Branch `fix/seo-and-feeds` (from `origin/dev`). No migration.

## Why

PickGear (a gaming gear price-comparison site) read Waimers' products from Shopify's public
JSON. After the move to Koomerce on 6 Nov every one of those URLs answered our HTML 404 page
(`/products.json`, `/collections/<h>/products.json`, `/products/<h>.json`, `/products/<h>.js`,
`/collections.json`), so the aggregator lost the whole catalogue. Cloudflare and our proxy do
not block any user agent (curl, python-requests, Go, an empty UA all get 200 on pages).

## What changed

- **Public JSON** (`apps/storefront/src/lib/shopify-json/`, copy and limits in
  `src/data/shopify-json.ts`):
  - `/products.json?limit=&page=` and `/collections/<h>/products.json` (`all` = every product):
    Shopify's list shape, prices as rupee strings (`"899.00"`), `variants[].available`,
    `compare_at_price`, `images[]` with sizes, `handle`, `vendor`, `product_type`, `tags`,
    `updated_at`. 30 by default, at most 250, pages 1 to 100.
  - `/products/<h>.json` (`{ product }`, Shopify's REST shape, tags as one string) and
    `/products/<h>.js` (the AJAX product in paise, the existing `shopifyProductJson`).
  - `/collections.json` and `/collections/<h>.json`.
  - Active products only, never the payments wizard's test product; hidden and archived
    variants are left out (`loadProducts`). No stock counts.
  - Rate limited per IP (120 a minute, `shopify-json:ip`), body cached per store version
    (`storeRead`), `cache-control: public, max-age=300, s-maxage=600`, `x-robots-tag: noindex`.
  - Routing: `/products.json`, `/collections.json`, `/collections/<h>/products.json` are route
    folders. `/products/<h>.json|.js` and `/collections/<h>.json` share their page's dynamic
    segment, so `routeForStore` rewrites them to child routes `product.json`, `product.js`,
    `collection.json` (`shopifyJsonPath`). The Hono product path and the CDN page rules skip them.
  - `@commerce/core` now exports `loadProducts`, `activeCollectionRows` and `richTextHtml`.
- **Shopify child sitemaps**: `/sitemap_products_1.xml`, `_collections_1`, `_pages_1`,
  `_blogs_1` (what Search Console was given before the move) serve that part of our sitemap via
  `sitemap.xml/[part]`. They pass the password page like `/sitemap.xml`.
- **Sitemap and llms.txt** leave out the system test product.
- **Product structured data**: each variant's offer links `?variant=<id>`; `gtin` from the
  barcode when it is a real 8/12/13/14-digit GTIN. `ProductDetail` variants carry `barcode`.
- **Product meta**: `product:price:amount` and `product:price:currency`.
- **Meta descriptions**: a page (`/pages/x`, React or plain HTML) or blog with no description of
  its own keeps the store's SEO description, as Shopify's `page_description` falls back to the
  shop's. Before, theme-built pages such as About, FAQ and Contact had no description at all.
- **Home (plain HTML)** now prints `og:url`.

## Left for the owner (store content, not code)

See the PR description: product and collection SEO descriptions, the 404ing
`/products/uncle-panda-mouse` redirect, product barcodes for GTINs, and resubmitting the
sitemap in Search Console.

## Not done

- `/collections/vendors?q=` and `/collections/types?q=` (Shopify's vendor and type pages; our
  `link_to_vendor` filter writes them) still 404. The live theme does not link them.
- No image sitemap entries.
