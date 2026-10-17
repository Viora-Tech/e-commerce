import OrderChip from '@/components/orders/order-chip'
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
    sortTitle: copy.sortTitles.product,
    sortLabels: copy.sortAlpha,
    hideable: false,
    align: 'start',
    className: 'w-[40%] whitespace-normal',
    render: (p) => {
      const pill = preorderPill(copy, p)
      return (
        <span className="flex items-center gap-3 text-left">
          <ProductThumb url={p.imageUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-body text-ink-strong">{p.title}</span>
            {pill ? <span className="text-caption text-muted-foreground">{pill}</span> : null}
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
    render: (p) => <OrderChip kind="product" value={p.status} />,
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
    sortTitle: copy.sortTitles.type,
    sortLabels: copy.sortAlpha,
    render: (p) => p.productType ?? copy.none,
  },
  {
    id: 'vendor',
    title: copy.columns.vendor,
    sortValue: (p) => p.vendor ?? '',
    sortLabels: copy.sortAlpha,
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
