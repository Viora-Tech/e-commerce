import StatusChip from '@/components/layout/status-chip'
import ProductThumb from '@/components/products/product-thumb'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { collectionsListContent } from '@/data/collections'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { ruleSummary } from './rule-summary'

export type CollectionRow = Awaited<ReturnType<typeof api.collections.list>>[number]

type ListCopy = typeof collectionsListContent.list

/** Columns of the collections list: title, product count, type and rule line, visibility, updated. */
export function collectionListColumns(
  copy: ListCopy,
  fmt: Formatters,
): ResourceColumnSpec<CollectionRow>[] {
  return [
    {
      id: 'collection',
      title: copy.columns.collection,
      sortValue: (c) => c.title,
      hideable: false,
      align: 'start',
      className: 'w-[34%] whitespace-normal',
      render: (c) => (
        <span className="flex min-w-0 items-center gap-3 text-left">
          <ProductThumb url={c.imageUrl} />
          <span className="line-clamp-2 text-body font-semibold text-ink-strong">{c.title}</span>
        </span>
      ),
    },
    {
      id: 'products',
      title: copy.columns.products,
      sortValue: (c) => c.productCount,
      align: 'end',
      render: (c) => <span className="tabular-nums">{fmt.number(c.productCount)}</span>,
    },
    {
      id: 'type',
      title: copy.columns.type,
      sortValue: (c) => c.kind,
      className: 'w-[26%] whitespace-normal',
      render: (c) => (
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <StatusChip className="h-5 px-2">{copy.kind[c.kind]}</StatusChip>
          {c.kind === 'automatic' ? (
            <span className="line-clamp-1 text-caption text-muted-foreground">
              {ruleSummary(c.rules, copy, fmt.money)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'visibility',
      title: copy.columns.visibility,
      sortValue: (c) => c.status,
      align: 'center',
      render: (c) => (
        <StatusChip tone={c.status === 'draft' ? 'attention' : 'neutral'}>
          {copy.visibility[c.status]}
        </StatusChip>
      ),
    },
    {
      id: 'updated',
      title: copy.columns.updated,
      sortValue: (c) => new Date(c.updatedAt).getTime(),
      render: (c) => (
        <span className="text-muted-foreground" title={fmt.dateTime(c.updatedAt)}>
          {fmt.when(c.updatedAt)}
        </span>
      ),
    },
  ]
}
