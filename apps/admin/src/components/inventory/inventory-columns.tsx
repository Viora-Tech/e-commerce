import { formatNumber } from '@commerce/money'
import ProductThumb from '@/components/products/product-thumb'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import AvailableCell from './available-cell'

export type InventoryRow = Awaited<ReturnType<typeof api.inventory.list>>['rows'][number]

type ColumnOptions = {
  copy: typeof inventoryContent
  canEdit: boolean
  /** At or below this many available a row reads as low (the store's low-stock setting). */
  lowAt: number
  onCommit: (row: InventoryRow, delta: number) => Promise<boolean>
}

export function rowName(row: InventoryRow): string {
  return row.variantTitle && row.variantTitle !== 'Default'
    ? `${row.productTitle} / ${row.variantTitle}`
    : row.productTitle
}

/** Columns of the inventory table (Shopify order): item, SKU, then the four counts. */
export function inventoryColumns({
  copy,
  canEdit,
  lowAt,
  onCommit,
}: ColumnOptions): ResourceColumnSpec<InventoryRow>[] {
  return [
    {
      id: 'product',
      title: copy.columns.product,
      sortValue: (r) => r.productTitle,
      hideable: false,
      align: 'start',
      className: 'w-80 px-3 whitespace-normal',
      render: (r) => (
        <span className="flex items-center gap-3 text-left">
          <ProductThumb url={r.imageUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-1 text-body text-ink-strong">{r.productTitle}</span>
            {r.variantTitle && r.variantTitle !== 'Default' ? (
              <span className="line-clamp-1 text-caption text-muted-foreground">
                {r.variantTitle}
              </span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      id: 'sku',
      title: copy.columns.sku,
      sortValue: (r) => r.sku ?? '',
      render: (r) =>
        r.sku ? (
          <span className="block max-w-56 truncate text-muted-foreground" title={r.sku}>
            {r.sku}
          </span>
        ) : (
          <span className="text-muted-foreground">{copy.noSku}</span>
        ),
    },
    {
      id: 'available',
      align: 'center',
      title: copy.columns.available,
      sortValue: (r) => r.available,
      hideable: false,
      className: 'w-44',
      render: (r) => (
        <AvailableCell
          name={rowName(r)}
          available={r.available}
          lowAt={lowAt}
          disabled={!canEdit}
          onCommit={(delta) => onCommit(r, delta)}
        />
      ),
    },
    {
      id: 'committed',
      align: 'center',
      title: copy.columns.committed,
      sortValue: (r) => r.committed,
      render: (r) => <span className="tabular-nums">{formatNumber(r.committed)}</span>,
    },
    {
      id: 'incoming',
      align: 'center',
      title: copy.columns.incoming,
      sortValue: (r) => r.incoming,
      render: (r) => <span className="tabular-nums">{formatNumber(r.incoming)}</span>,
    },
    {
      id: 'onHand',
      align: 'center',
      title: copy.columns.onHand,
      sortValue: (r) => r.onHand,
      render: (r) => <span className="tabular-nums">{formatNumber(r.onHand)}</span>,
    },
  ]
}
