# Shopify importer: what's left to import, problems by cause, faster copies (2026-10-05)

Branch `feat/shopify-import-status-ui`. **Migration `0088_shopify_import_only_missing`**:
`shopify_import_run.only_missing boolean default false`.

- **Main page "What's left to import"** (`remaining-card.tsx`, API `shopifyImport.status` →
  `remainingStatus` in `packages/plugin-shopify-import/src/status.ts`): per type In Shopify
  (Shopify's own counts where the Admin API has them, cached 3 min per store; else the latest
  preview's), Here (import mappings), Missing, Status and a per-row button; Product images on
  their own row; last import time and whether a fresh preview will be reused.
- **Import remaining** (`createRemainingRun`, API `importRemaining`): one import writing only
  records with no mapping or an open problem (`remainingFilter`); reuses a fresh preview copy.
- **Run page:** "Files: 1,240 of 2,300" bar while running; problems grouped by cause with one
  fix link each (`issueGroups`, API `shopifyImport.issueGroups`), per-record list behind
  "Show every record"; by-type table trimmed on phones.
- **Faster R2/S3 copies:** files 12 at a time, images 10 per product, one shared cap of 16
  downloads (`createLimiter` in `concurrency.ts`); `StorageProvider.putStream` (optional;
  R2/S3 via `storage-s3-compat`, memory provider for tests) streams download → bucket when the
  type and size are known.
- Copy in `data/shopify-import.ts` (`remaining`, `run.problems`, `run.now`) with Hindi.
- Docs: developer docs "Shopify importer" (three new sections).
