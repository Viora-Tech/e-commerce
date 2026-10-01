/**
 * SOURCE OF TRUTH KEYWORDS: PAGE_SIZE_MAX, PAGE_MAX, SEARCH_MAX, BULK_MAX, router input limits
 * WHAT:  The ceilings router inputs share: rows per page, page number, search text length and
 *        ids per bulk action.
 * WHY:   The same `.max(100)` / `.max(200)` was typed into every list router; one number per
 *        rule means raising "rows per page" is one edit, and a new router cannot pick its own.
 *        Routers with a deliberately different ceiling keep a literal and an entry in the
 *        router-magic-limits sweep's allow-list saying why.
 * WHERE: `packages/api/src/routers/*` list/search/bulk inputs; scripts/sweeps/router-magic-limits.
 */

/** Most rows one list page may ask for. */
export const PAGE_SIZE_MAX = 100

/** Highest page number a list may ask for (deep paging past this is a search problem). */
export const PAGE_MAX = 10_000

/** Longest search box text a list accepts. */
export const SEARCH_MAX = 200

/** Most ids one bulk action (archive, tag, mark as...) may carry. */
export const BULK_MAX = 200
