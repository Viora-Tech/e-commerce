# Storefront search matches descriptions and every word; Edit code is clean again after undo

Branch `fix/storefront-search-and-editor-dirty`. No migration.

- **Storefront search** (`packages/core/src/catalog/browse.ts`, shared by `/search`, the header's
  predictive search via `suggestProducts`, and the Liquid search page). Searching "pulsar" on the
  Waimers store found 23 products against Shopify's 82: most Pulsar mice only name the brand in
  their description (their vendor is "Waimers"). Search now also matches the product handle, option values (Search & Discovery's variant-title scope) and
  the description's plain text (Lexical text nodes via `jsonb_path_query_array(description,
  'lax $.**.text')`, or a legacy plain-string description), so node keys such as "paragraph" are
  not searchable. A query is split into up to eight words (`searchTerms`) and every word must
  match some field, as Shopify does. Ranking: title starts with the query, title contains it,
  title holds every word, every word in title/vendor/type/handle/tags/SKU, then
  description-only matches. System test products (`is_system_test`) are left out of results.
- Performance: no new index. Matching is `ilike` over one store's products (RLS scope) and the
  search page is cached per store version; a GIN trigram index would not help the OR across
  columns and a variant subquery. Revisit with a `search_text` column + `pg_trgm` if a store
  reaches tens of thousands of products.
- **Edit code "Unsaved" after undo** (`apps/admin/src/hooks/use-code-buffers.ts`). Dirty state
  already compared each open file's text with its saved text, but a textarea reports line breaks
  as `\n`: a CRLF file (themes authored on Windows) never matched its saved copy once edited,
  even after Ctrl+Z back to the original, so "Unsaved" and the leave-page prompt stuck. Files
  are now normalised to LF when read and edited (`editorText` in `apps/admin/src/lib/theme-code.ts`),
  the version diff normalises the saved version too, and `isDirty(buffer)` is the one dirty check
  used by the tabs, top bar, Back and `beforeunload`. Saving an edited CRLF file writes LF.
- Tests: `browse.test.ts` (DB, needs Postgres) covers vendor/handle/SKU/description matching,
  multi-word queries and ranking; `searchTerms` and `editorText` have unit tests.
