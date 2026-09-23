import ProductThumb from '@/components/products/product-thumb'
import StatusLabel from '@/components/status/status-label'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { productsListContent as copy } from '@/data/products'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

export type ProductRow = Awaited<ReturnType<typeof api.products.list>>['items'][number]

function priceRange(row: ProductRow): string {
  if (row.minPricePaise == null) return copy.none
  if (row.maxPricePaise == null || row.maxPricePaise === row.minPricePaise) {
    return formatPaise(row.minPricePaise)
  }
  return `${formatPaise(row.minPricePaise)} to ${formatPaise(row.maxPricePaise)}`
}

/** Columns of the product list: text left, figures right (Saleor datagrid). */
export const productColumns: ResourceColumnSpec<ProductRow>[] = [
  {
    id: 'product',
    title: copy.columns.product,
    sortValue: (p) => p.title,
    hideable: false,
    align: 'start',
    className: 'w-[40%] whitespace-normal',
    render: (p) => (
      <span className="flex items-center gap-3 text-left">
        <ProductThumb url={p.imageUrl} />
        <span className="line-clamp-2 text-body-strong text-ink-strong">{p.title}</span>
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (p) => p.status,
    render: (p) => <StatusLabel kind="product" value={p.status} variant="pill" />,
  },
  {
    id: 'inventory',
    title: copy.columns.inventory,
    sortValue: (p) => p.available,
    render: (p) => (
      <span className={p.available === 0 ? 'text-destructive' : 'text-muted-foreground'}>
        {copy.inventory(p.available, p.variantCount)}
      </span>
    ),
  },
  {
    id: 'type',
    title: copy.columns.type,
    sortValue: (p) => p.productType ?? '',
    render: (p) => p.productType ?? copy.none,
  },
  {
    id: 'vendor',
    title: copy.columns.vendor,
    sortValue: (p) => p.vendor ?? '',
    render: (p) => p.vendor ?? copy.none,
  },
  {
    id: 'price',
    title: copy.columns.price,
    sortValue: (p) => p.minPricePaise ?? 0,
    align: 'end',
    render: (p) => <span className="tabular-nums">{priceRange(p)}</span>,
  },
]
