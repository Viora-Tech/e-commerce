# GrowthBook A/B tests app

Branch `feat/app-growthbook`. A `connection` app (`packages/plugin-growthbook`, id `growthbook`,
category `marketing`; GrowthBook is MIT outside its enterprise folders, the JS SDK
`@growthbook/growthbook` is MIT and pinned at 1.8.0; credited in the manifest and
`THIRD_PARTY_NOTICES.md`; radar row now "In use").

- **Settings** (`store.apps.settings.growthbook`): API host (Cloud `cdn.growthbook.io` or
  self-hosted), SDK client key (`sdk-…`), optional decryption key, GrowthBook app address, optional
  secret API key (encrypted with `SETTINGS_SECRET`, never returned).
- **Storefront**: `lib/experiments.ts` assigns shoppers on the server with the SDK
  (`GrowthBookClient`), one evaluator per SDK connection cached 60 s, 2 s fetch timeout, failures
  remembered for the minute. Only after a yes to analytics and with a `wc_vid` visitor id; everyone
  else sees each experiment's control. Theme previews show every variant's sections.
- **Sections**: every section has an **A/B test** settings group (`settings.experiment = { key,
  variant }`, `packages/blocks/src/section-experiment.ts`); `renderTemplate` drops non-matching
  top-level sections before rendering.
- **Liquid**: `request.experiments['<tracking key>']` → variation number. Imported themes' render
  cache keys include the assignments (only when there are any).
- **Prices**: deliberately out of scope (consumer-protection and GST invoice consistency);
  documented in the merchant guide and developer docs.
- **Events**: new table `experiment_event` (migration `0143_app_growthbook`, RLS): exposures (from
  `ExperimentBeacon` on pages that drew gated sections; every assigned experiment under an
  imported theme) and purchases (thank-you page, orders < 24 h old, once per order), via
  `POST /api/experiments`, which re-checks consent and recomputes the variation.
- **GrowthBook data source**: per-store views + read-only role SQL, and the assignment / purchase /
  revenue queries, in developer docs "A/B tests (GrowthBook)". `app.store_id` is deliberately not
  the guard (any session can `SET` it).
- **Admin**: Apps → GrowthBook: status, connect + test, how-to, experiment list from the REST API
  (running first, status/verdict, tracking key, variants, Open in GrowthBook). English + Hindi copy.
- **Env**: `GROWTHBOOK_TRUSTED_ORIGINS` (optional; our own GrowthBook on a private network).
- Tests: `packages/plugin-growthbook/test/{assign,client,settings}.test.ts` (SDK evaluation incl.
  an encrypted payload, mocked fetch), blocks section-settings, core `experiments-liquid.test.ts`,
  storefront `liquid-cache.test.ts`. Typecheck: plugin-growthbook, blocks, core, api, config,
  storefront, admin, www. Not run: build, DB tests, a real GrowthBook.
- Not done: visual-editor / URL-redirect experiments; per-store data source provisioning is a
  manual SQL step for the platform operator.
