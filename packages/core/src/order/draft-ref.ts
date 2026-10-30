/**
 * SOURCE OF TRUTH: draft numbers (#D12) — WHAT: how a draft order is named and found by its own
 * number / WHY: drafts count on their own series (audit #26), so the admin list, the draft page,
 * the invoice and search all show and accept "D12" the same way.
 *
 * A draft saved since 0200 holds a placeholder below zero in `order.number` (minus its draft
 * number) until it converts and takes a real order number. Drafts from before keep the order
 * number they reserved. Pure: no database import, so admin client code can use it through
 * `@commerce/core/draft-number`.
 */

/** "D12": a draft's number as the admin and the invoice show it, after a `#`. */
export const draftLabel = (draftNumber: number): string => `D${draftNumber}`

/** An `order.number` that is only a draft's placeholder, not a real order number. */
export const isDraftPlaceholder = (number: number): boolean => number <= 0

/** The placeholder a new draft keeps in `order.number` until it converts. */
export const draftPlaceholder = (draftNumber: number): number => -draftNumber

/**
 * What follows the `#` for an order or a draft: "D12" while it is a draft with a draft number,
 * else the order number ("2374").
 */
export function orderRef(o: {
  number: number
  draftNumber?: number | null | undefined
  status?: string | undefined
}): string {
  const asDraft = o.status === undefined || o.status === 'draft' || isDraftPlaceholder(o.number)
  if (asDraft && o.draftNumber) return draftLabel(o.draftNumber)
  return String(o.number)
}

/**
 * The draft number a search box means by "D12", "#D12" or "# d 12"; null for anything else.
 * A plain "12" is not a draft number (it still matches order numbers and text).
 */
export function parseDraftSearch(search: string): number | null {
  const m = /^#?\s*d\s*-?\s*(\d{1,9})$/i.exec(search.trim())
  if (!m?.[1]) return null
  const n = Number(m[1])
  return n > 0 ? n : null
}
