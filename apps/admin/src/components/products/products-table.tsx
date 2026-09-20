'use client'

import { DataTable, type DataTableColumn } from '@commerce/ui/global/data-table'
import { Badge } from '@commerce/ui/shadcn/badge'
import { useRouter } from 'next/navigation'
import { formatPaise } from '@/lib/money'
import type { ProductListItem } from './types'

const STATUS_CLASSES: Record<ProductListItem['status'], string> = {
  active: 'bg-success/15 text-success border-success/30',
  draft: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  archived: 'bg-muted text-muted-foreground',
}

const columns: DataTableColumn<ProductListItem>[] = [
  {
    key: 'title',
    label: 'Product',
    flex: 3,
    render: (p) => (
      <span className="flex min-w-0 items-center gap-3">
        {p.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: 40px CDN thumbnail.
          <img
            src={p.imageUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="size-10 shrink-0 rounded-lg bg-secondary" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{p.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[p.vendor, p.productType].filter(Boolean).join(' · ') || '—'}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: 'w-[110px]',
    render: (p) => (
      <Badge variant="outline" className={STATUS_CLASSES[p.status]}>
        {p.status}
      </Badge>
    ),
  },
  {
    key: 'variants',
    label: 'Variants',
    width: 'w-[90px]',
    align: 'right',
    render: (p) => <span className="tabular-nums">{p.variantCount}</span>,
  },
  {
    key: 'available',
    label: 'Stock',
    width: 'w-[90px]',
    align: 'right',
    render: (p) => (
      <span className={`tabular-nums ${p.available === 0 ? 'text-destructive' : ''}`}>
        {p.available}
      </span>
    ),
  },
  {
    key: 'price',
    label: 'From',
    width: 'w-[110px]',
    align: 'right',
    render: (p) => (
      <span className="tabular-nums">
        {p.minPricePaise != null ? formatPaise(p.minPricePaise) : '—'}
      </span>
    ),
  },
]

export function ProductsTable(props: {
  products: ProductListItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}) {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      data={props.products}
      getRowId={(p) => p.id}
      selectable
      selectedIds={props.selectedIds}
      onSelectionChange={props.onSelectionChange}
      onRowClick={(p) => router.push(`/products/${p.id}`)}
      loading={props.loading}
      error={props.error}
      onRetry={props.onRetry}
      emptyMessage="No products match"
      emptyDescription="Try a different search or clear the filters."
    />
  )
}
