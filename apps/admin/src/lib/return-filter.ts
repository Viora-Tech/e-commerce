import type { ReturnStatus } from '@commerce/core/returns'

/** The Returns list tabs, in the order a merchant works through them. */
export const RETURN_LIST_FILTERS = ['requested', 'inProgress', 'received', 'done', 'rto'] as const
export type ReturnListFilter = (typeof RETURN_LIST_FILTERS)[number]

/** What each tab asks the API for. */
export function returnListFilter(tab: ReturnListFilter | null): {
  status?: ReturnStatus[]
  kind?: 'return' | 'rto'
} {
  switch (tab) {
    case 'requested':
      return { status: ['requested'] }
    case 'inProgress':
      return { status: ['approved', 'in_transit'] }
    case 'received':
      return { status: ['received'] }
    case 'done':
      return { status: ['resolved', 'rejected', 'cancelled'] }
    case 'rto':
      return { kind: 'rto' }
    default:
      return {}
  }
}
