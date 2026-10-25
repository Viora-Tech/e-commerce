import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { suppliersContent } from '@/data/purchasing'
import type { api } from '@/lib/api-client'

export type SupplierRow = Awaited<ReturnType<typeof api.suppliers.list>>['rows'][number]

const quiet = (text: string) => <span className="text-muted-foreground-soft">{text}</span>

/** Columns of the supplier list. */
export const supplierColumns = (
  copy: typeof suppliersContent,
): ResourceColumnSpec<SupplierRow>[] => [
  {
    id: 'name',
    title: copy.columns.name,
    sortValue: (r) => r.name,
    hideable: false,
    align: 'start',
    className: 'w-64 px-3',
    render: (r) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body text-ink-strong">{r.name}</span>
        {r.address ? (
          <span className="truncate text-caption text-muted-foreground">{r.address}</span>
        ) : null}
      </span>
    ),
  },
  {
    id: 'country',
    title: copy.columns.country,
    sortValue: (r) => r.country,
    render: (r) => r.country,
  },
  {
    id: 'currency',
    title: copy.columns.currency,
    sortValue: (r) => r.currency,
    render: (r) => r.currency,
  },
  {
    id: 'gstin',
    title: copy.columns.gstin,
    sortValue: (r) => r.gstin ?? '',
    render: (r) => (r.gstin ? <span className="tabular-nums">{r.gstin}</span> : quiet(copy.none)),
  },
  {
    id: 'terms',
    title: copy.columns.terms,
    sortValue: (r) => r.paymentTerms ?? '',
    render: (r) =>
      r.paymentTerms ? <span className="truncate">{r.paymentTerms}</span> : quiet(copy.none),
  },
  {
    id: 'orders',
    align: 'end',
    title: copy.columns.orders,
    sortValue: (r) => r.orders,
    render: (r) => <span className="tabular-nums">{r.orders}</span>,
  },
]
