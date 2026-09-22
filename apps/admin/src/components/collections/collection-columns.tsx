'use client'

import { Pencil, Trash2 } from '@commerce/ui/icons'
import Link from 'next/link'
import KitThumb from '@/components/kit/kit-thumb'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { collectionsListContent as copy } from '@/data/collections'
import { formatDay } from '@/lib/format-date'

/** The row shape the table needs; the service returns a superset. */
export type CollectionProductRow = {
  id: string
  title: string
  imageUrl: string | null
  createdAt: Date | string
  available: number
}

const ACTION =
  'inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Frame 5:4194: No. comes from the selection column, then product, date, stock, actions. */
export function collectionProductColumns<T extends CollectionProductRow>(
  onDelete: (product: T) => void,
): ResourceColumnSpec<T>[] {
  return [
    {
      id: 'product',
      title: copy.columns.product,
      align: 'start',
      sortValue: (p) => p.title,
      hideable: false,
      className: 'whitespace-normal',
      render: (p) => (
        <span className="flex min-w-0 items-center gap-3">
          <KitThumb src={p.imageUrl} alt="" />
          <span className="min-w-0 flex-1 truncate">{p.title}</span>
        </span>
      ),
    },
    {
      id: 'created',
      title: copy.columns.created,
      sortValue: (p) => new Date(p.createdAt).getTime(),
      render: (p) => <span className="tabular-nums">{formatDay(p.createdAt)}</span>,
    },
    {
      id: 'stock',
      title: copy.columns.order,
      sortValue: (p) => p.available,
      render: (p) => <span className="tabular-nums">{p.available}</span>,
    },
    {
      id: 'action',
      title: copy.columns.action,
      hideable: false,
      render: (p) => (
        <span className="flex items-center gap-2">
          <Link
            href={`/products/${p.id}`}
            aria-label={copy.rowActions.edit}
            title={copy.rowActions.edit}
            className={ACTION}
          >
            <Pencil className="size-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(p)
            }}
            aria-label={copy.rowActions.remove}
            title={copy.rowActions.remove}
            className={ACTION}
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
        </span>
      ),
    },
  ]
}
