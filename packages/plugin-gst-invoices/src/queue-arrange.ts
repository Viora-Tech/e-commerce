/**
 * SOURCE OF TRUTH: how the Queue page's rows are sorted, split into Ready / Needs fixing and
 * paged (owner 23 Nov 2026). Pure: a draft's status is worked out in code (`queueStatus`), so the
 * whole filtered queue is read, then arranged here; the counts are over every view.
 */
import type { QueueStatus } from './queue-status'

/** The Queue's sortable columns: date due, order number, taxable value and GST. */
export const QUEUE_SORTS = ['date', 'number', 'taxable', 'gst'] as const
export type QueueSort = { by: (typeof QUEUE_SORTS)[number]; desc: boolean }

/**
 * Oldest first, by day then order number: the order `issueDrafts` numbers a batch in, so the
 * list reads in the order the invoices will be numbered. Kept as the default on purpose.
 */
const DEFAULT_QUEUE_SORT: QueueSort = { by: 'date', desc: false }

/** The Queue's views besides All: rows that can be issued now, and rows that need fixing. */
export const QUEUE_VIEWS = ['ready', 'fix'] as const
export type QueueView = (typeof QUEUE_VIEWS)[number]

export type QueueSortable = {
  status: QueueStatus
  orderNumber: number
  /** When the draft became due (`eligible_at`). */
  dueAt: Date | null
  taxablePaise: number
  gstPaise: number
}

const DAY_MS = 86_400_000
const IST_OFFSET_MS = 330 * 60_000

const isReadyStatus = (status: QueueStatus) => status.startsWith('ready')

/** The due day in India, then the order number, as one number (what Date sorts by). */
export function queueDateKey(r: Pick<QueueSortable, 'dueAt' | 'orderNumber'>): number {
  if (!r.dueAt) return r.orderNumber
  return Math.floor((r.dueAt.getTime() + IST_OFFSET_MS) / DAY_MS) * 10_000_000 + r.orderNumber
}

const KEY: Record<QueueSort['by'], (r: QueueSortable) => number> = {
  date: queueDateKey,
  number: (r) => r.orderNumber,
  taxable: (r) => r.taxablePaise,
  gst: (r) => r.gstPaise,
}

export type QueueCounts = { all: number; ready: number; fix: number; hsnMissing: number }

/**
 * Sort (stable: ties keep the order they came in), count, keep one view and cut one page.
 * `page` starts at 1; a page past the end is empty.
 */
export function arrangeQueue<T>(
  items: readonly T[],
  pick: (item: T) => QueueSortable,
  opts: {
    sort?: QueueSort | undefined
    view?: QueueView | undefined
    page: number
    perPage: number
  },
): { rows: T[]; total: number; counts: QueueCounts } {
  const sort = opts.sort ?? DEFAULT_QUEUE_SORT
  const key = KEY[sort.by]
  const sign = sort.desc ? -1 : 1
  const sorted = items
    .map((item, index) => ({ item, s: pick(item), index }))
    .sort((a, b) => sign * (key(a.s) - key(b.s)) || a.index - b.index)
  const ready = sorted.filter((r) => isReadyStatus(r.s.status))
  const counts: QueueCounts = {
    all: sorted.length,
    ready: ready.length,
    fix: sorted.length - ready.length,
    hsnMissing: sorted.filter((r) => r.s.status === 'hsn_missing').length,
  }
  const shown =
    opts.view === 'ready'
      ? ready
      : opts.view === 'fix'
        ? sorted.filter((r) => !isReadyStatus(r.s.status))
        : sorted
  const start = (Math.max(1, opts.page) - 1) * opts.perPage
  return {
    rows: shown.slice(start, start + opts.perPage).map((r) => r.item),
    total: shown.length,
    counts,
  }
}
