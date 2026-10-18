/**
 * SOURCE OF TRUTH: bulk "Write with AI" choices — WHAT which product fields a bulk AI run can
 * write and how many products one run takes / WHY the products list, the API and the worker
 * agree on one list. Pure and client-safe.
 */

/**
 * Fields a bulk run writes: description, search title and description, tags, photo alt text,
 * and search keywords (suggested by a call of their own, see `seo-keywords`).
 */
export const BULK_WRITE_FIELDS = ['description', 'seo', 'tags', 'altText', 'keywords'] as const
export type BulkWriteField = (typeof BULK_WRITE_FIELDS)[number]

/** Most products in one bulk AI run (the assistant's per-action limit). */
export const BULK_WRITE_MAX = 200

/** True when a run writes product copy (every field but keywords comes from the copy call). */
export function writesCopy(fields: readonly BulkWriteField[]): boolean {
  return fields.some((field) => field !== 'keywords')
}

/** AI requests one product costs in a run: one for keywords, one for the copy. */
export function bulkCallsPerProduct(fields: readonly BulkWriteField[]): number {
  return (fields.includes('keywords') ? 1 : 0) + (writesCopy(fields) ? 1 : 0)
}
