# Home stats: Sessions first, real sessions

Owner asked for Shopify's tile order on the Home analytics card: **Sessions, Total sales, Orders,
Conversion rate**.

- **New `sessions` metric** (`@commerce/core/home-metrics`). Default tiles are now
  `sessions, sales, orders, conversion`. A member whose saved tiles are exactly the old default
  (`sales, orders, visitors, conversion`) gets the new order; other custom choices are kept.
  `visitors` (unique visitors) stays in the metric picker.
- **What Sessions counts**: `marketing_session` rows, which the storefront beacon writes when a
  visit starts (no `wc_ses` cookie, 30 minutes sliding) or a tagged landing (UTM / gclid / tracked
  link) starts a new one. One visitor can have many sessions. Consent-gated like every storefront
  number. Counted per IST day, or per IST hour for a single day, so "Today" now has a sessions line.
  Helper: `packages/api/src/services/sessions.ts`.
- **Conversion rate** is now orders ÷ sessions (it was orders ÷ unique visitors from the Redis
  HyperLogLog). For a single day the line is the running rate by hour.
- The opening chart stays **Total sales** when it is one of the tiles (else the first tile).
- **Analytics overview** KPI strip: same order (Sessions, Revenue, Orders, Conversion, AOV,
  Returning). Its "Sessions" was unique visitors with a hard-coded 0 for the previous period; it
  now counts `marketing_session` rows for both periods, so the change % and conversion change work.
- Copy (EN + HI): `metrics.sessions`, empty state, Sessions help text.

Not run: lint and build (owner's request). `packages/api/test/analytics.test.ts` updated to seed
sessions; not run here.
