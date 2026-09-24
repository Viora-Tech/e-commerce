import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { transfersContent as copy } from '@/data/inventory'
import type { api } from '@/lib/api-client'

export type TransferRow = Awaited<ReturnType<typeof api.transfers.list>>['rows'][number]

const number = new Intl.NumberFormat('en-IN')

/** Columns of the transfer list. */
export const transferColumns: ResourceColumnSpec<TransferRow>[] = [
  {
    id: 'number',
    title: copy.columns.number,
    sortValue: (r) => r.number,
    hideable: false,
    render: (r) => <span className="text-body-strong">{copy.number(r.number)}</span>,
  },
  {
    id: 'from',
    title: copy.columns.from,
    sortValue: (r) => r.fromName,
    render: (r) => r.fromName,
  },
  {
    id: 'to',
    title: copy.columns.to,
    sortValue: (r) => r.toName,
    render: (r) => r.toName,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (r) => r.status,
    render: (r) => <StatusLabel kind="transfer" value={r.status} />,
  },
  {
    id: 'units',
    title: copy.columns.units,
    sortValue: (r) => r.units,
    render: (r) => <span className="tabular-nums">{number.format(r.units)}</span>,
  },
  {
    id: 'created',
    title: copy.columns.created,
    sortValue: (r) => new Date(r.createdAt),
    render: (r) => <RelativeTime value={r.createdAt} />,
  },
]
