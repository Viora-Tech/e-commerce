import Link from 'next/link'
import CopyButton from '@/components/fields/copy-button'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import type { gstInvoicesContent } from '@/data/gst-invoices'
import type { gstListFiltersContent } from '@/data/gst-list-filters'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'

export type InvoiceRow = Awaited<ReturnType<typeof api.gstInvoices.list>>['rows'][number]

type Copy = {
  list: (typeof gstInvoicesContent)['list']
  kinds: (typeof gstInvoicesContent)['kinds']
  lists: typeof gstListFiltersContent
  record: typeof gstAlreadyInvoicedContent
}

/**
 * The Invoices list's columns: number, type, order, buyer, date, status, tax and total. Number,
 * Date and Total sort on the server; their sort values are the server's keys (`dateKey`,
 * `numberKey`), so the table's own sort of a page reads the same.
 */
export function invoiceColumns(copy: Copy): ResourceColumnSpec<InvoiceRow>[] {
  const c = copy.list.columns
  const s = copy.lists.sort
  return [
    {
      id: 'number',
      title: c.number,
      sortTitle: s.invoiceNumber,
      sortRank: 1,
      sortLabels: s.lowest,
      hideable: false,
      className: 'w-44',
      sortValue: (r) => r.numberKey,
      render: (r) => (
        <span className="flex items-center gap-1 font-medium">
          <Link
            href={routes.apps.page('gst-invoices', 'invoices', r.id)}
            className="hover:underline"
          >
            {r.number ?? '-'}
          </Link>
          {r.number ? <CopyButton value={r.number} what={c.number} /> : null}
        </span>
      ),
    },
    { id: 'kind', title: c.kind, className: 'w-32', render: (r) => copy.kinds[r.kind] },
    {
      id: 'order',
      title: c.order,
      className: 'w-28',
      render: (r) => (
        <Link href={routes.orders.detail(r.orderId)} className="hover:underline">
          {r.orderName}
        </Link>
      ),
    },
    {
      id: 'buyer',
      title: c.buyer,
      className: 'w-48 whitespace-normal',
      render: (r) => (
        <span className="flex flex-col text-left">
          {r.buyerName}
          {r.buyerGstin ? (
            <span className="text-caption text-muted-foreground">{r.buyerGstin}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'date',
      title: c.date,
      sortTitle: s.invoiceDate,
      sortRank: 0,
      sortLabels: s.oldest,
      className: 'w-32',
      sortValue: (r) => r.dateKey,
      render: (r) =>
        r.source === 'external' && !r.number ? (
          <span className="text-muted-foreground">{copy.record.noDate}</span>
        ) : (
          <RelativeTime value={r.invoiceDate ?? r.issuedAt} />
        ),
    },
    {
      id: 'status',
      title: c.status,
      align: 'center',
      className: 'w-44',
      render: (r) => (
        // A recorded invoice has no PDF here: say so, so no one waits for a print.
        <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
          <StatusLabel kind="gstDoc" value={r.status} variant="soft" />
          {r.source === 'external' ? (
            <span title={r.number ? copy.record.notPrintedHelp : copy.record.noDetailsBody}>
              <StatusChip tone="neutral">{copy.record.notPrinted}</StatusChip>
            </span>
          ) : r.status === 'issued' && !r.printedAt ? (
            <StatusChip tone="attention">{copy.record.notPrintedYet}</StatusChip>
          ) : null}
        </span>
      ),
    },
    {
      id: 'tax',
      title: c.tax,
      align: 'end',
      className: 'w-28',
      render: (r) => formatPaise(r.taxPaise),
    },
    {
      id: 'total',
      title: c.total,
      sortTitle: s.amount,
      sortLabels: s.lowest,
      align: 'end',
      className: 'w-28',
      sortValue: (r) => r.totalPaise,
      render: (r) => formatPaise(r.totalPaise),
    },
  ]
}
