/**
 * SOURCE OF TRUTH: bulk "Write with AI" choices — WHAT which product fields a bulk AI run can
 * write and how many products one run takes / WHY the products list, the API and the worker
 * agree on one list. Pure and client-safe.
 */

/** Fields a bulk run writes: description, search title and description, tags, photo alt text. */
export const BULK_WRITE_FIELDS = ['description', 'seo', 'tags', 'altText'] as const
export type BulkWriteField = (typeof BULK_WRITE_FIELDS)[number]

/** Most products in one bulk AI run (the assistant's per-action limit). */
export const BULK_WRITE_MAX = 200
