# Product page reads its variants' extra fields in one call

The product page's variant fields card asked `metaobjects.metafields` once per variant: a product
with 25 sizes sent 25 requests, each with its own session, membership and grants lookups and its
own transaction. On the scaled test store that page made 750 DB statements per load, the most of
any admin page.

- New `metaobjects.variantMetafields({ variantIds })` (up to 250): the variant definitions once
  and every variant's values in one query, keyed by variant id
  (`getMetafieldsForOwners` in `@commerce/core`). Same permission checks as `metafields`.
- `variant-metafields-card.tsx` makes that one call.
- Test: `packages/api/test/metafield-owners.test.ts` (the batched answer equals the per-variant
  answers).
- No migration.
