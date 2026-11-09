# Blocks: ProductBuyButtons component order (2026-11-08)

- `bun run lint:components` failed on `dev` (#1319): the sticky-bar pre-order label effect from
  #1102 sat after a derived value, so the checker saw the hooks and handlers out of order. The
  effect now lives in a module-scope `useStickyPreorderLabel(label)` hook in
  `packages/blocks/src/components/product-buy-buttons.tsx`. Behaviour is unchanged.
