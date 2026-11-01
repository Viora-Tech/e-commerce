# Check pass 3 on dev (31 Oct)

After pre-orders, AI reports, A/B rollouts and Search & discovery landed unchecked:

- blocks tests: stub `onAddToCart` returns `undefined` to match `AddToCart`.
- Component order fixes in the Search app pages (boosts, synonyms, recommendations) and the
  rollout audience/results cards.
- Storefront store layout was over the 500-line cap: the starter header/footer menus moved to
  `apps/storefront/src/lib/starter-menus.ts`.
- Biome formatting across the new code; optional chain in `campaignApplies`; a11y note on the
  pre-order stock meter.

Typecheck (all 61 packages), biome and `lint:components` are clean. Tests still wait for Postgres.
