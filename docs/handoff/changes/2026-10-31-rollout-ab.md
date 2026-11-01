# Rollouts: A/B test a theme (2026-10-31, #120)

A rollout can run as an A/B test (Shopify's rollout **Audience**): Control vs Treatment, split
50/50 by default and adjustable, a traffic allocation %, eligible markets, a target for the
"Reached" ring, and notes. It ends with **Ship Treatment** or **Keep Control**.

## Data (migration 0210)

- `rollout`: `notes`, `audience` (jsonb `{ split, traffic, marketIds, target }`, null = no test),
  `ab_outcome` (`treatment` | `control`). `rollout` now carries the `storefront_cache_notify`
  trigger and moved from `STOREFRONT_CACHE_EXEMPT` to `STOREFRONT_CACHE_TABLES`: starting, pausing
  or ending a test changes what the storefront draws.
- `rollout_ab_event` (RLS): per visitor `exposure` (fixes the arm), first `add_to_cart`, and one
  `purchase` per order (`value_minor`, the order total). Exempt from the cache (LOG).

## Core (`packages/core/src/rollouts`)

- `ab.ts` (pure, `@commerce/core/rollout-ab`): `assignArm` hashes the visitor id with the rollout
  id (FNV-1a + murmur finaliser), separate draws for traffic and arm, so raising the traffic never
  moves anyone. `twoProportionZ`, `abVerdict` (needs 100 visitors per arm and 10 orders; ~90/95/99%).
  Tests: `ab.test.ts`; DB flow in `rollouts.test.ts` ("A/B rollouts").
- `ab-service.ts`: `activeAbTests`, `recordAbExposure`, `recordAbAddToCart`, `recordAbPurchase`,
  `rolloutAbResults` (sessions from `marketing_session` by visitor id while the test ran),
  `rolloutMarketOptions`.
- `service.ts`: an A/B rollout must hold splittable kinds only (`AB_SPLITTABLE_KINDS = ['theme']`).
  Start sets it active without applying anything; pause/resume touch nothing; `endRollout` with
  `apply` = Ship Treatment (applies the changes), `rollback` = Keep Control. A running test keeps
  its split, traffic and markets; name, notes, target and end stay editable. An A/B launch holds its
  theme window until it ends (conflict checks).
- API: `rollouts.results`, `rollouts.listMarkets`.

## Storefront

- `lib/rollout-ab.ts`: `requestRolloutArm` (per request; first running test the visitor is in),
  `abThemeId`. Out of every test: no analytics consent / no `wc_vid`, bots, outside traffic or
  markets, theme previews. Exposure is written after the response, once per process per visitor.
- Wired into `liveThemeId` (template-render), the layout's theme settings and `requestThemeId`
  (Liquid section rendering). Add to cart (`addLineAction`) and the thank-you purchase
  (`/api/experiments`, beacon shown when a test runs) are recorded per arm.
- Caching: with no running test the only cost is one cached read (`rollout-ab-tests`). Render keys
  already carry the theme id, so the arm splits them only while a test runs. Tested visitors carry
  `wc_vid`, which already keeps their pages out of the CDN; cookieless pages are always Control.

## Can't be split (yet)

- **Checkout branding**: the checkout's look is computed from several stored settings and the
  pay / thank-you pages read it too; per-visitor branding needs the checkout to know the arm.
- **Discounts**: a discount sets the price in the cart, checkout, order and cached product cards
  for everyone; splitting it would mean per-visitor pricing.
A rollout with either is refused as an A/B test with that reason.

## Admin

`/markets/rollouts/[id]`: Audience card (toggle, split slider, traffic slider, markets, target),
Results card (Reached ring, per-arm table, z-test hint, outcome), Notes card; header actions
**Keep Control** / **Ship Treatment** while a test runs. Copy in `data/rollouts.ts` + Hindi.
