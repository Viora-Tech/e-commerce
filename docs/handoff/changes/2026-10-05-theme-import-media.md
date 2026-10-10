# Theme import media (#283)

- Theme zip import now falls back to the store's connected Shopify importer address when the "store address" field is empty; the field stays as an override (copy updated, English + Hindi).
- Before downloading, the import reuses media the Shopify importer already copied: `shopify_import_mapping` `media` rows (matched by the CDN file name) and new `file_name` rows (Shopify file name, written by the importer from now on, needed for videos; re-run the importer to fill older stores). No migration.
- `importThemeZip` logs unexpected failures and answers with a plain-words error; the request transaction rolls back, so no half-made theme stays.
- Publishing: `publishTheme` already demotes the previous main in the same transaction and `theme_one_main_per_store` (partial unique index) makes two mains impossible in the database; regression test added.
