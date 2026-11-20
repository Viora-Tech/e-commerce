# November small batch (branch `feat/nov-small-batch`)

Four small roadmap items, one commit each.

## 1. Ad clicks get the cached page

- Why it was slow: the Cloudflare cache rule "Store pages" keys by the full URL, and every ad
  click carries a unique `fbclid` / `gclid`, so each ad visitor was a cache miss and waited on the
  origin (up to 4.6 s on a cold product page). The origin already ignores these params
  (`edgeCacheControl` reads no query; `listingSearch` drops them from the Liquid cache key).
- Cache Rules can only drop query params from the key on Enterprise. A Transform Rule (Rewrite
  URL) runs before the cache on every plan and can `remove_query_args(...)`, so that is the fix.
- `apps/storefront/src/lib/tracking-params.ts` is the one list (click ids `fbclid`, `gclid`,
  `gbraid`, `wbraid`, `dclid`, `gad_source`, `gad_campaignid`, `ttclid`, `msclkid`, `twclid`,
  `li_fat_id`, `igshid`, and the `utm_*` tags), with `isTrackingParam`, `withoutTrackingParams`
  and `cloudflareTrackingRewrite()` that prints the rule's expression and query rewrite.
- Attribution is unchanged: the address bar keeps the params, and the beacon (`/api/beacon`) and
  pixels (`/api/px`) read `location.href`. `/api/`, `/_next/` and `/webhooks/` are never
  rewritten. `ref` (affiliate) is not in the list.
- Docs: developer docs "Storefront performance" → "Cloudflare in front", step 4, "Ad clicks".
- Tests: `apps/storefront/src/lib/tracking-params.test.ts` (11, run).
- **Owner:** add the Transform Rule on the SaaS zone (steps in the docs). Check with
  `curl -sI "https://www.waimers.in/?fbclid=test1"` twice with different values: the second says
  `cf-cache-status: HIT`.
