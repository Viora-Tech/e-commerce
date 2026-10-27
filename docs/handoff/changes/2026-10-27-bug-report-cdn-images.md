# "Report a bug" screenshots: product pictures no longer blank

The #804 fix (bypass the cache for other hosts) was not enough: live bug reports still showed
empty tiles where product pictures sit. Those `<img>`s load from `cdn.koomerce.app` and
`cdn.shopify.com` without CORS, and the library's own fetch of the same URL depends on the
CDN's CORS answer.

`apps/admin/src/lib/capture-page.ts` now passes modern-screenshot a `fetchFn` that loads every
cross-origin picture through the admin's own `/_next/image?url=…&w=640&q=75`: same origin, so
CORS never applies, and the picture is smaller. Both CDNs are already in `images.remotePatterns`.
Anything else (same-origin files, hosts the optimiser refuses) returns `false`, which hands the
URL back to the library's default fetch. Only the screenshot changes; the page itself is untouched.
