import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import type { gstListFiltersContent } from '@/data/gst-list-filters'
import type { gstQueuePageContent } from '@/data/gst-queue-page'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { routes } from '@/lib/routes'

export type QueueRow = Awaited<ReturnType<typeof api.gstInvoices.queue.list>>['rows'][number]

type Copy = {
  queue: typeof gstQueuePageContent
  lists: typeof gstListFiltersContent
  record: typeof gstAlreadyInvoicedContent
}

type Handlers = {
  busy: boolean
  /** Issue just this one (through the review step, which confirms its date). */
  onIssue: (row: QueueRow) => void
  /** "Already invoiced": record the invoice this order got outside Koomerce. */
  onRecord: (row: QueueRow) => void
}

const TONE: Record<QueueRow['status'], ChipTone> = {
  ready: 'success',
  ready_b2b: 'info',
  ready_export: 'info',
  hsn_missing: 'attention',
  buyer_details: 'attention',
}

export const isReadyRow = (r: QueueRow) => r.status.startsWith('ready')

/** Where a row's Fix goes: the product missing an HSN code, or the order for buyer details. */
const fixHref = (row: QueueRow) =>
  row.fix?.kind === 'product'
    ? routes.products.detail(row.fix.productId)
    : routes.orders.detail(row.orderId)

const fixHelpOf = (row: QueueRow, copy: Copy['queue']) =>
  row.status === 'hsn_missing' || row.status === 'buyer_details'
    ? copy.fixHelp[row.status]
    : undefined

/**
 * The Queue's columns (Figma 928:10728): order and when it became due, products, customer,
 * GSTIN, taxable, GST, status, then Already invoiced and Issue or Fix. Order, Date, Taxable and
 * GST sort on the server; each sort value is the server's own key, so a page reads the same.
 */
export function queueColumns(
  copy: Copy,
  fmt: Formatters,
  handlers: Handlers,
): ResourceColumnSpec<QueueRow>[] {
  const c = copy.queue
  const s = copy.lists.sort
  return [
    {
      id: 'number',
      title: c.columns.order,
      sortTitle: s.orderNumber,
      sortRank: 1,
      sortLabels: s.lowest,
      hideable: false,
      className: 'w-32',
      sortValue: (r) => r.orderNumber,
      render: (r) => (
        <Link href={routes.orders.detail(r.orderId)} className="font-medium hover:underline">
          {r.orderName}
        </Link>
      ),
    },
    {
      id: 'date',
      title: copy.lists.dateColumn,
      sortTitle: s.dueDate,
      sortRank: 0,
      sortLabels: { ...s.oldest, first: 'asc' },
      className: 'w-36',
      sortValue: (r) => r.dateKey,
      render: (r) => {
        const joined = r.eligibleAt ?? r.placedAt
        return joined ? <span className="text-muted-foreground">{fmt.when(joined)}</span> : null
      },
    },
    {
      id: 'products',
      title: c.columns.products,
      className: 'w-64 whitespace-normal',
      render: (r) => {
        const first = r.items[0]
        return (
          // What it bills: the first item, then "+ n more" (owner, 18 Nov 2026).
          <span
            className="flex flex-col text-left"
            title={r.items.map((i) => `${i.title} × ${i.quantity}`).join(', ')}
          >
            <span className="line-clamp-1">
              {first ? `${first.title} × ${first.quantity}` : ''}
            </span>
            {r.items.length > 1 ? (
              <span className="text-caption text-muted-foreground">
                {c.moreItems(r.items.length - 1)}
              </span>
            ) : null}
          </span>
        )
      },
    },
    {
      id: 'customer',
      title: c.columns.customer,
      className: 'w-48 whitespace-normal',
      render: (r) => (
        <span className="flex flex-col text-left">
          {r.buyerName}
          <span className="text-caption text-muted-foreground">{r.buyerPlace || r.export}</span>
        </span>
      ),
    },
    {
      id: 'gstin',
      title: c.columns.gstin,
      className: 'w-40',
      render: (r) => <span className="font-mono text-caption">{r.buyerGstin ?? c.none}</span>,
    },
    {
      id: 'taxable',
      title: c.columns.taxable,
      align: 'end',
      sortLabels: s.lowest,
      className: 'w-28',
      sortValue: (r) => r.taxablePaise,
      render: (r) => fmt.moneyWhole(r.taxablePaise),
    },
    {
      id: 'gst',
      title: c.columns.gst,
      align: 'end',
      sortLabels: s.lowest,
      className: 'w-28',
      sortValue: (r) => r.gstPaise,
      render: (r) => fmt.moneyWhole(r.gstPaise),
    },
    {
      id: 'status',
      title: c.columns.status,
      className: 'w-40',
      render: (r) => (
        <span title={fixHelpOf(r, c)}>
          <StatusChip tone={TONE[r.status]}>{c.statuses[r.status]}</StatusChip>
        </span>
      ),
    },
    {
      id: 'action',
      title: c.columns.action,
      align: 'end',
      hideable: false,
      className: 'w-56',
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={handlers.busy}
            aria-label={copy.record.actionLabel(r.orderName)}
            onClick={() => handlers.onRecord(r)}
          >
            {copy.record.action}
          </Button>
          {isReadyRow(r) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={handlers.busy}
              onClick={() => handlers.onIssue(r)}
            >
              {c.issue}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              title={fixHelpOf(r, c)}
              nativeButton={false}
              render={<Link href={fixHref(r)} />}
            >
              {c.fix}
            </Button>
          )}
        </span>
      ),
    },
  ]
}
