# Online store → Preferences: Shopify parity

Compared with Shopify admin → Online Store → Preferences (help.shopify.com, October 2026).

**New on the page** (all stored in `store.preferences` JSON, so no migration):

- **Search engine visibility**: `indexing.searchEngines` (default on). When it's off, every
  storefront page gets `robots: noindex, nofollow`, robots.txt returns `Disallow: /`, the sitemap
  is empty and llms.txt returns 404. The password page does the same as before (`searchIndexable()`
  in `@commerce/core/preferences`).
- **AI crawlers**: `indexing.aiCrawlers` (default on). When it's off, robots.txt adds a
  `Disallow: /` group for the known AI bots (`AI_CRAWLERS` in `apps/storefront/src/data/seo.ts`)
  and llms.txt returns 404. Search crawlers are unaffected. This setting has no effect while
  search indexing is off.
- **Site verification**: `verification.{google,bing,meta,pinterest}`. The merchant can paste
  the token or the whole `<meta>` tag; we keep the `content` part and check its characters. The
  tags render through Next's `verification` metadata (`verificationMeta()` in
  `apps/storefront/src/lib/seo.ts`) on every storefront page and on the password page.
- **Google Ads tag**: `tracking.googleAds` (`AW-…`). It loads under marketing consent and shares
  one `gtag.js` load with GA4 (`tracking-tags.tsx`).
- **Spam protection** card: explains what's already on (honeypots, rate limits, OTP sign-in).
  There's no toggle.
- **More storefront settings** card: links to the Favicon (Themes), URL redirects (Navigation)
  and Domains instead of repeating them.
- **Social sharing image**: the empty state is now a clickable share-card-shaped placeholder,
  and Choose / Change / Remove are right-aligned. It still uses `MediaPickDialog`.

**Skipped**: hCaptcha (needs a third-party key, and honeypots plus rate limits already cover
it), B2B-only access, automatic market and language redirection, and hreflang (we have a single
market and language).
