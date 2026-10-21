# Koomerce Search: typo tolerance, synonyms, Search & discovery app

Built-in search (no search server) gets Shopify Search & Discovery's first features.

- **Typo tolerance** (`packages/core/src/catalog/search-text.ts`, `search-words.ts`): when the
  words as typed find nothing, each unknown word is corrected to the nearest word of the store's
  own catalogue (titles, vendors, types, tags, option values; read at most once a minute per
  store), edit distance 1 up to 7 letters and 2 from 8, never numbers/SKUs or words under 4
  letters. `browseProducts` returns `corrected`; the search page shows "Showing results for …"
  (our themes; Liquid themes get the corrected results without the line). Predictive search does
  the same retry. Normal searches run exactly as before (no extra query).
- **Synonyms** in `store.preferences.searchSynonyms` (no migration), cleaned and capped
  (`search-limits.ts`). Each word matches itself or any synonym. The Preferences form can no
  longer overwrite them (`store.service.ts`).
- **Search & discovery** Koomerce app (`packages/plugin-search`, id `search`): Synonyms page
  (EN + HI), API `search.synonyms.get/set` (requires the app installed).
- `searchTerms` moved to `search-text.ts`.
- Brand name in the "Koomerce apps" copy (#653) now reads `siteConfig.brand.name` (site-config
  sweep); S3 policy statement ids are brand-free (`StoreFiles…`).

Open source: Meilisearch/Typesense need a server (radar); this is plain Postgres + own code.
Next: boosts and pins per search term; search analytics (top and no-result searches).
