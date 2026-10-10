# Umami visitor analytics app

Branch `feat/umami-analytics`. A `connection` app (`packages/plugin-umami`, id `umami`,
category `analytics`, credited in the manifest and `THIRD_PARTY_NOTICES.md`; Umami is MIT).

- **Settings** (`store.apps.settings.umami`, no migration): Umami address (self-hosted or
  `cloud.umami.is`), website id, API key (encrypted with `SETTINGS_SECRET`, never returned),
  `waitForConsent` (default on).
- **Admin**: Apps → Umami (`components/apps/umami/settings-page.tsx`): connect, create a website
  for the store through the Umami API, test connection, remove key, consent switch.
- **Analytics page**: `VisitorsSection` under the existing cards: 5 figures (visitors, visits,
  page views, left after one page, average visit), visitors/page views per day, top pages,
  referrers, UTM campaigns, countries, devices, browsers. Follows the range picker. Empty
  states: not installed (link to Apps), not connected (link to the app), Umami error.
- **Storefront**: `ConsentManager` loads `UmamiScript` (`<url>/script.js`, `data-website-id`,
  nonce) after analytics consent, or until a no when the store turned waiting off. Never on
  sign-in pages.
- **Core**: `safeFetch` takes `method`, `headers`, `body`; headers are dropped on a cross-origin
  redirect; non-GET redirects are returned, not followed (tests added).
- **Env**: `UMAMI_TRUSTED_ORIGINS` (optional; our own Umami on the private network / http).
- Not done: Hindi copy for the new strings; `rotate-secrets` does not re-encrypt the key in
  `store.apps` (it decrypts through `SETTINGS_SECRET_PREVIOUS` and re-encrypts on save); no
  local Umami container run (owner rule: no servers/tests), so the API shapes follow Umami's
  source (v3.4) and docs, with Umami 2 fallbacks.
- Tests written (not run, per owner rule): `packages/plugin-umami/test/{settings,report,client}.test.ts`,
  two new cases in `packages/core/src/net/safe-fetch.test.ts`.
- Docs: merchant guide Selling → Visitor analytics (Umami); developer docs Plugins (Umami
  paragraph).
