# `bun run lint` passes on dev again

Branch `chore/component-lint-clean`. No migration, no API change, no behaviour change.

- Biome: the 265 storefront flag SVGs (`apps/storefront/public/flags`, copied from
  country-flag-icons, see `THIRD_PARTY_NOTICES.md`) are ignored in `biome.json`; they are vendored
  assets shown through `<img alt>`, so `noSvgWithoutTitle` does not apply. Unused imports dropped
  in `packages/api` `routers/gst-invoices.ts` and `services/order.service.ts`; Biome format/import
  order in `packages/db` `index.ts` and `resolve-store.ts`, `packages/core` `inbox/panel.test.ts`
  and `media/pipeline.test.ts`, and `docs/themes/waimers-revamp/header-float.css`.
- Component checker (`bun run lint:components`), refactors only:
  - `components/orders/order-view.tsx` (512 lines): side column moved to `order-side-column.tsx`
    (`INVOICES_APP` / `INVOICES_ANCHOR` now exported from there). Permissions are still read in
    `OrderView` and passed in as `canRetry` / `showMargin`.
  - `components/themes/customize/customize-editor.tsx` (502 lines): the six context providers moved
    to `customize-contexts.tsx`.
  - `components/products/bulk-shipping-dialog.tsx`: box presets via `use-box-presets.ts`; the
    weight/box choice is `bulkShippingChoice` in `bulk-shipping-state.ts` (tested).
  - `components/shipments/create-shipment/bulk-edit-dialog.tsx`: reset-on-order-change state in
    `use-choice-for-order.ts`; batch lookup `batchPosition` in `bulk-edit-state.ts` (tested).
- Both big files are still over the 300-line soft cap (warning only): `order-view.tsx` 459,
  `customize-editor.tsx` 494. The next feature in either should split more out first.
- Owed: a browser smoke check of an order page, Products → Set weight and box, the bulk
  create-shipment "Edit" popup, and Themes → Customize.
- Open PRs touching the same files (mechanical changes only, may need a trivial rebase):
  #1581 and #1582 (`packages/db/src/index.ts`, `resolve-store.ts`), #1566
  (`packages/core/src/media/pipeline.test.ts`), #1416 spike (`biome.json`).
