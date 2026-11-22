# Search Console "Why pages aren't indexed": fixes (22 Nov 2026)

Read from Search Console (www.waimers.in, read only) and checked live with curl. Platform fixes,
for every store:

- **Sitemap lists only URLs that answer 200 and may be indexed** (`lib/seo-files.ts`
  `loadStoreIndex`, also feeds llms.txt). The live sitemap had 9 bad entries out of 346:
  - empty collections (`/collections/1337gears`, `/collections/new-arrivals`: "Nothing in this
    collection yet", Search Console's two soft 404s) are left out: a collection is listed only
    when it has an active product (`exists` on `collection_product` + `product`);
  - the five policy pages were listed as `/pages/<policy>` (308 to `/policies/<type>`); they are
    now listed at `/policies/<type>` (`pageIndexPath`);
  - `/pages/wishlist` (a fixed noindex route owns the handle, `SHADOWED_PAGE_HANDLES` in
    `data/seo.ts`) is left out;
  - any path a URL redirect sends elsewhere is left out (`withoutRedirected`): the redirect wins
    over the product, so the URL answered 301 (Waimers: `/products/x2n-crazylight-medium-gaming-mouse`
    is an active product with a redirect to `/products/x2n-crazylight-gaming-mouse`).
- **Empty collection pages are `noindex, follow`** (Shopify answers 200 too; we keep the page for
  shoppers and links but tell Google it is not content). Back in the index once it has products.
- **`?page=` past the last page is a 404** (`pastLastPage` in `lib/seo.ts`). It used to render
  the empty grid with a self canonical, so `/collections/pulsar?page=5`, `?page=6`, `?page=9` were
  the same page: "Duplicate, Google chose different canonical than user".
  `loadCollectionView` is shared by `generateMetadata` and the page (same `storeRead` key).
- **robots.txt**: `Disallow: /api/` with `Allow:` for what pages render with
  (`/api/section-styles`, `/api/islands/`, `/api/hono-island/`; `ROBOTS_ALLOW`). GET on the
  POST-only beacons (`/api/vitals`, `/api/beacon`, `/api/consent-shown`, `/api/experiments`)
  answered 405: "Blocked due to other 4xx issue".
- **Reviews widget "Sign in to review" link is `rel="nofollow"`**: Google found
  `/account/login?return_to=/products/x#reviews` on every product ("Indexed, though blocked by
  robots.txt").

Healthy, no change: Page with redirect (apex to www, old Shopify handles, non-ASCII handles);
Alternate page with proper canonical (`?variant=`, Shopify `_pos/_fid/_ss`, `?page=1`, utm);
Blocked by robots.txt (cart, account, search, Shopify `/services/…`, old filter URLs); Excluded by
noindex (filters, search, login, wishlist); remaining 404s (nonce junk from before the base64url
fix, `/upload/*.m3u8`, Shopify `.atom` feeds, `/cdn`, `/wpm`, `/password`); the 13 redirects
added earlier today all answer 301.

Not ours or owner's call: "Crawled / Discovered - currently not indexed" are mostly `_next` font
files, island scripts, Shopify `.atom` feeds and thin or near-duplicate product pages (`-copy`
handles, colour editions); Google indexes them in its own time. Owner: fill or archive the empty
`new-arrivals` and `1337gears` collections; archive `x2n-crazylight-medium-gaming-mouse` or delete
its redirect.

Tests: `apps/storefront/src/lib/seo.test.ts` (robots allow/disallow, `pageIndexPath`,
`withoutRedirected`, `pastLastPage`), run; storefront `tsc` clean. `apps/storefront-hono` not
changed.
