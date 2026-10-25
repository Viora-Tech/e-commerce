# Shopify import never reuses a preview copy saved by older code

Branch `fix/import-template-suffix-snapshot`. No migration.

- An import reuses the preview's saved copy (`snapshot.ts`) for 24 hours. A copy saved before
  #594 has no `templateSuffix` on its items, so a re-import after that release wrote every page
  without its template (Waimers' about, faq, guides… stayed on "Default page").
- `ImportSnapshot` now records `format`; `SNAPSHOT_FORMAT` (`client.ts`, now 2) is raised whenever
  a reader adds a field the writers use. `freshSnapshot` treats a copy of another format (or none)
  as stale, so the import reads Shopify again.
