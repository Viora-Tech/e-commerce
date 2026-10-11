# Shopify import: only used files, size estimate, no 960 variant, file_url (2026-10-11)

- Files step copies only files that products, collections, pages and articles use (`plugin-shopify-import/src/file-usage.ts`); "Also import unused files" (migration 0112, `shopify_import_run.include_unused_files`) copies all. New left-behind reason `unused_file` (English and Hindi copy). Files-only runs copy everything they are given.
- `progress.files.estimate`: counts + size after optimizing (pictures from dimensions/bytes, videos from the chosen renditions); shown on the run page (`run-files-card.tsx`).
- `VARIANT_WIDTHS` is 320/640/1280/1920. `Picture` builds its srcset from the widths a row has, so old media with a 960 variant and new media without both work; the loader already chose from the row's own widths.
- `file_url` returns the stored URL for a file the importer copied (loose name match), else the old Shopify host.
- Not done: files used only by theme settings are not known to the data import; the theme import still copies the ones it names. Existing 960 variants are not deleted.
