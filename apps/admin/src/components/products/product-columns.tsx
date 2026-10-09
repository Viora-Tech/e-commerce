import StatusChip from '@/components/layout/status-chip'
import ProductThumb from '@/components/products/product-thumb'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { productsListContent } from '@/data/products'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

export type ProductRow = Awaited<ReturnType<typeof api.products.list>>['items'][number]

/** At or below this many units a product reads as low on stock (the stock filter uses the same number). */
const LOW_STOCK_AT = 5

type ListCopy = typeof productsListContent

/** Small status pill for the list; a product past its launch date is on sale, not "Launching". */
function preorderPill(copy: ListCopy, row: ProductRow): string | null {
  if (row.launchAt && new Date(row.launchAt).getTime() > Date.now()) {
    return copy.launching(new Date(row.launchAt))
  }
  return row.preorderEnabled ? copy.preorderPill : null
}

function priceRange(copy: ListCopy, fmt: Formatters, row: ProductRow): string {
  if (row.minPricePaise == null) return copy.none
  if (row.maxPricePaise == null || row.maxPricePaise === row.minPricePaise) {
    return fmt.money(row.minPricePaise)
  }
  return copy.priceRange(fmt.money(row.minPricePaise), fmt.money(row.maxPricePaise))
}

/** Columns of the product list: text left, figures right (Saleor datagrid). */
export const productColumns = (
  copy: ListCopy,
  fmt: Formatters,
): ResourceColumnSpec<ProductRow>[] => [
  {
    id: 'product',
    title: copy.columns.product,
    sortValue: (p) => p.title,
    hideable: false,
    align: 'start',
    className: 'w-[40%] whitespace-normal',
    render: (p) => {
      const pill = preorderPill(copy, p)
      return (
        <span className="flex items-center gap-3 text-left">
          <ProductThumb url={p.imageUrl} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="line-clamp-2 text-body-strong text-ink-strong">{p.title}</span>
            {pill ? (
              <span className="w-fit rounded-full bg-accent px-2 py-0.5 text-caption text-accent-foreground">
                {pill}
              </span>
            ) : null}
          </span>
        </span>
      )
    },
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (p) => p.status,
    align: 'center',
    render: (p) => (
      <StatusChip tone={p.status === 'draft' ? 'info' : 'neutral'}>
        {copy.status[p.status]}
      </StatusChip>
    ),
  },
  {
    id: 'inventory',
    title: copy.columns.inventory,
    sortValue: (p) => p.available,
    render: (p) => (
      <span className="flex flex-col leading-tight">
        <span
          className={
            p.available === 0
              ? 'text-danger'
              : p.available <= LOW_STOCK_AT
                ? 'text-warning'
                : 'text-foreground'
          }
        >
          {copy.inStock(p.available)}
        </span>
        <span className="text-caption text-muted-foreground">{copy.variants(p.variantCount)}</span>
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
    render: (p) => <span className="tabular-nums">{priceRange(copy, fmt, p)}</span>,
  },
]
