/** Browser-safe inventory helpers: pure stock maths and input schemas, no database. */
export * from './schemas'
export * from './stock'

/**
 * SOURCE OF TRUTH KEYWORDS: TRANSFER_STATUSES, TransferStatus, stock transfer status
 * WHAT:  A stock transfer's statuses, in order: draft → in_transit → received.
 * WHY:   The admin list filter and labels read this instead of a copy in admin data (the DB
 *        column's enum in `packages/db/src/schema.ts` must list the same three).
 * WHERE: Admin transfers list and page; core `inventory/transfers.ts` moves between them.
 */
export const TRANSFER_STATUSES = ['draft', 'in_transit', 'received'] as const
export type TransferStatus = (typeof TRANSFER_STATUSES)[number]
