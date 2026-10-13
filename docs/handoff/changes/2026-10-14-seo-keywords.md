# AI SEO keywords

Per product, the merchant keeps 5–10 search keywords (primary first). AI suggests them; Write with AI
(one product, bulk, and the SEO report's Fix with AI) builds the search title and description around
the primary one. Built on the existing AI pieces: same engine, guard, quotas, switches, permissions,
bulk runner, review and undo. No new AI feature switch: single suggestions run under `productWriter`,
bulk under `bulkWriter`.

**Storage: `product.seo_keywords text[] not null default '{}'`** (migration `0118_seo_keywords`).
Chosen over a metafield because the SEO report counts it per product in its one product query
(`cardinality(...)`), the AI undo snapshot and bulk apply patch it like `seo_title`, and the product
form saves it with everything else. Primary = first element, so no second column. The intent tag
(buy / compare / info) is shown while choosing and not stored: it only helps the merchant pick, and
keywords typed by hand have none. Left out of a product write (CSV import, API callers) means
unchanged (`productRow` only sets it when given); duplicate copies it.

**AI (`packages/ai/src/seo-keywords/`)**
- `schema.ts` (client-safe): `SeoKeywordsSchema` (model output), `clampKeywords` (normalise, dedupe,
  max 10, exactly one primary placed first, `seen` when a Search Console query matches),
  `normaliseKeyword`, `addKeyword`, `makePrimary`, `mergeKeywords` (a product with keywords keeps its
  own primary), `keywordList`, `containsKeyword`, `parseSuggestedKeywords`.
- `prompt.ts`: instructions (India, English plus Hindi/Hinglish only where natural, price phrases only
  when the price fits, one primary, never invent features, store text is data) and content (facts
  through `guardData`, up to 20 Search Console queries).
- `product-writer/prompt.ts`: `ProductWriterInput.keywords`; with keywords the message says: primary
  once near the start of the search title within 60 characters, once in the description within 155,
  others at most once where natural, keep them as written in Hindi. No keywords: prompt unchanged.
- `product-writer/bulk.ts`: `keywords` joins `BULK_WRITE_FIELDS`; `writesCopy`, `bulkCallsPerProduct`.
- Mock model answers the keyword marker with canned keywords and uses the primary in its SEO text.

**Search Console hook (`packages/core/src/seo/search-queries.ts`)**: `setSearchQueriesSource(fn)`;
`searchQueriesForPath(tx, storeId, '/products/<handle>')` returns `[]` when nothing is registered or
the source throws (run in a savepoint so the caller's transaction survives). The Search Console PR
registers its reader there; this PR compiles and works without it.

**Core**: `seo/keywords.ts` (`categoryPath` from the vendored taxonomy, `productSearchQueries`,
`productKeywordFacts`); `ai/bulk-write.ts` runs a keyword call first when the run has `keywords`
(own admission and metering), then the copy call steered by the product's saved keywords or, when it
has none, the ones just suggested; the suggestion JSON is the copy plus `keywords`. `ai/jobs.ts`:
item view gets `keywords` and `current.seoKeywords`; apply merges keywords; the undo snapshot
(`product-fields.ts`) includes `seoKeywords` (older snapshots without it restore as before).
`seo/checks.ts`: `keyword_missing` (low, Fix with AI → `keywords`), only when `keywordCount` is given.
Every store's score drops a little on deploy (1 point per live product with no keywords, scaled).

**API**: `ai.suggestKeywords` (`canDetached(PRODUCTS_WRITE)`, like `writeProduct`; skipped in the
cross-store walk: it reaches the model); `ai.writeProduct` takes `keywords`. `ProductFieldsSchema`
takes `seoKeywords` (max 10, 60 characters each).

**Admin**: Search keywords card on the product SEO tab (`seo-keywords-card.tsx`,
`seo-keyword-suggestions.tsx`): suggest, tick, star for primary, remove, add your own; saved with the
save bar. Write with AI sheet sends the keywords, says which keyword it writes around, and the preview
says whether the suggested search title and description use it. Bulk sheet: "Suggest search
keywords" option, cost line counts 2 requests per product when keywords and copy are both ticked,
review shows the keyword chips. SEO report: Fix with AI → "Suggest search keywords (n)". Copy in
`data/seo-keywords.ts` (+ Hindi), `assistant.ts`, `seo-report.ts`.

**Storefront**: nothing. No `meta keywords` tag (ignored by search engines); merchant docs say so.

**Docs**: merchant guide `products/search-keywords.mdx`, `settings/ai.mdx` (data sent); developer docs
`building/ai-engine.mdx`.

Tests written, not run here (owner rule): `packages/ai/test/seo-keywords.test.ts`,
`packages/core/src/seo/checks.test.ts` (keyword_missing). Run on dev after merge.
