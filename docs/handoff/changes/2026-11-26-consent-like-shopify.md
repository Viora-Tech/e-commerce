# Cookie banner by region, like Shopify (26 Nov 2026)

Owner: "I want to track pixel without that cookies button, I want how Shopify does it."
Branch `feat/consent-like-shopify`.

## What changed

- **New setting** Settings → Privacy & data requests → Cookie banner → **Who sees the banner**:
  `consent_required` ("Only where consent is required", the default for every store, old and new)
  or `everyone` ("Ask everyone", the old behaviour). Stored as
  `store.preferences.customerPrivacy.bannerRegions` (zod default, so there is **no migration**).
  The `customerPrivacy.saveSettings` input takes it (optional; left out keeps the stored value).
- **Regions** (`packages/core/src/online-store/consent.ts`): `CONSENT_REQUIRED_COUNTRIES` (EU 27 +
  IS, LI, NO, GB, CH, Shopify's "regions requiring consent"), `consentRegion`, `effectiveConsent`,
  `bannerAsks`, `IMPLIED_CONSENT`. Country comes from Cloudflare's `CF-IPCountry`
  (`visitorCountry` in `lib/routing.ts`, the only geo header the code already read). Unknown
  country counts as not requiring consent.
- **Open region**: no banner; analytics + marketing count as allowed unless the shopper saved a
  no (any banner version). Visit beacon, GA4/GTM/Ads, Meta pixel, Pixels app, Umami, Chatwoot,
  experiments, discovery and the affiliate referral cookie run on the first page. Cookie
  settings (`#cookie-settings`) still opens the choice. **Ask region**: unchanged.
- **Server checks** now go through `lib/consent-cookie.ts` (`requestConsent`, `consentOf`,
  `analyticsAllowed(storeId)`, `marketingAllowed(storeId)`): proxy visitor id, referral landing,
  `/api/referral`, `/api/beacon`, `/api/experiments`, `/api/px`, `/api/px/me` (hashed match),
  cart contact sync (server Purchase consent), checkout "share this order", short links,
  experiments, A/B rollouts, discovery. `storefrontLock` now carries `bannerRegions` and
  `bannerVersion`.
- **Edge cache**: a shared (CDN) page goes to visitors from every country, so the proxy marks it
  `x-consent-pending: 1` (a derived header) and it is drawn with no banner and nothing optional;
  the browser asks the new `GET /api/consent-region` (never cached, once per tab via
  sessionStorage `wc_consent_region`), which also mints `wc_vid` for open visitors. Then the
  banner (ask) or the tags (open) start. React (`hooks/use-consent-state.ts`), the plain HTML
  island (`lib/plain-html/islands.ts`) and the Hono product page all do this.
- **Imported Liquid themes**: the shim gets `askConsent`, `consentPending`, `granted`
  (`shimConsentOf`); `analyticsProcessingAllowed()` / `marketingAllowed()` now answer the real
  consent. `liquid-consent-reveal` queues itself while pending and reveals (without moving focus)
  when `window.__commerceConsentRegion(true)` is called.
- Admin copy + Hindi overlay (`data/hi/customer-privacy.ts`, new keys translated, rest
  `untranslated`). Merchant guide `settings/customer-privacy.mdx` updated.

## Tests

New `packages/core/src/online-store/consent.test.ts`, `app/api/consent-region/route.test.ts`;
region cases in `consent-manager.test.ts`, `liquid-consent-reveal.test.ts`, `px/me/route.test.ts`.

## Owner notes

- Performance: open-region shoppers now get `wc_vid` on their first page, so their later pages
  skip the Cloudflare page cache (as shoppers who pressed Accept already did). First views stay
  cacheable (drawn pending).
- Visit numbers, pixel events and Meta server Purchases for Indian shoppers will rise sharply:
  they were mostly missing before (no banner answer = no tracking).
