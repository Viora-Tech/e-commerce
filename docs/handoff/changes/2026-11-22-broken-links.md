# Search Console 404s: junk links, non-ASCII handles, robots.txt, Broken links tab

Search Console listed 124 404s on www.waimers.in after the move from Shopify. Platform fixes, for
every store:

- **Junk links (`/z3oF6Ceu76Y4U3F6bpjNw==`, `/p/rTkb+N5jFDLtEGNIoWw==`)**: our CSP nonce. Next
  writes it into each page's flight data (`"nonce":"…"` inside `self.__next_f.push` script text),
  and Googlebot read the base64 values as relative links (a `/` in one made `/p/…`). `newNonce`
  (`apps/storefront/src/lib/csp.ts`) now mints base64url without padding (no `/`, `+`, `=`), which
  CSP accepts and the plain-HTML / Hono nonce checks already allowed. Google may still try an odd
  alphanumeric string; those stay 404 and are left out of the log. `/${t}` most likely comes from Cloudflare's
  RUM beacon (`/cdn-cgi/rum?${t}`), `/b` and the 31–32 character tokens from minified third-party
  or framework script: not ours, they stay 404.
- **Non-ASCII Shopify handles**: the importer keeps every ASCII word (`slugify`:
  `talongames-幻-maboroshi-…` → `talongames-maboroshi-…`, now tested). The storefront product and
  collection lookups (`lib/catalog.ts`, `lib/collections.ts`) try `handleCandidates(handle)`:
  the percent-decoded handle, its lower case, then the ASCII slug (`@commerce/core/catalog`). The
  live Waimers product is `talongames-series-gaming-mousepad` (its handle lost "maboroshi" some
  other way, not via `slugify`), so that one needs the hand-made redirect; the Broken links tab
  suggests that target for it.
- **robots.txt** (`data/seo.ts`): `Disallow` for `/theme-actions/`, `/newsletter/confirm/`,
  `/unsubscribe/`, `/cod/` (trailing slash, so a page such as `/cod-guide` stays crawlable).
- **Broken links log**: migration `0263_broken_links` (`broken_link`: store_id, path, hits,
  last_seen, referrer, dismissed_at; RLS). `not-found.tsx` counts each page-load 404
  (`lib/broken-links.ts`: in-memory buffer, one upsert per store every 30 s, 2,000 paths per
  window, 5,000 rows per store). `shouldLogBrokenLink` (core `redirects/broken-links.ts`) skips
  assets, `/api`, `/_next`, `/-…`, `/theme-*`, `/cdn-cgi`, `/wp-*`, files with an extension,
  `=`/`+`/`${` junk and random tokens. The path is the redirect form, no query; the referrer is
  origin + path only. Client navigations and the themed reload are not counted.
- **Admin**: Content › Menus › URL redirects has a Redirects / Broken links view select. Broken
  links lists the most-visited paths with the closest product or collection (word overlap,
  `suggestRedirect`), a one-click Create redirect (`redirects.save`; the row then leaves the list),
  Choose target when nothing is close, and Dismiss (comes back if hit again). API:
  `redirects.brokenLinks`, `redirects.dismissBrokenLinks`. Copy in `data/broken-links.ts` + Hindi.
- **Redirects table**: long "Redirect from" / "Redirect to" paths truncate with the full path on
  hover; the two columns take 40% / 36% so they no longer run into Source.

Follow-ups: no retention prune for `broken_link` yet (the per-store cap bounds it).
