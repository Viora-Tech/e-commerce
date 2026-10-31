import { formatNumber } from '@commerce/money'
import { cn } from '@commerce/ui/lib/utils'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import AvailableCell from './available-cell'
import type { InventoryLine } from './inventory-tree'
import ProductLineCell from './product-line-cell'

export type InventoryRow = Awaited<ReturnType<typeof api.inventory.list>>['rows'][number]

type ColumnOptions = {
  copy: typeof inventoryContent
  canEdit: boolean
  /** At or below this many available a row reads as low (the store's low-stock setting). */
  lowAt: number
  onCommit: (row: InventoryRow, delta: number) => Promise<boolean>
  /** Products view: which product lines are open, and how to fold one. Null in the SKUs view. */
  tree?: { expanded: Record<string, boolean>; onToggle: (lineId: string) => void } | null
}

/** A product line's summed count: read only, its SKUs are edited one by one. */
function total(n: number, lowAt?: number) {
  return (
    <span
      className={cn(
        'tabular-nums',
        lowAt !== undefined && n <= 0 && 'text-destructive',
        lowAt !== undefined && n > 0 && n <= lowAt && 'text-warning',
      )}
    >
      {formatNumber(n)}
    </span>
  )
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
  tree,
}: ColumnOptions): ResourceColumnSpec<InventoryLine>[] {
  return [
    {
      id: 'product',
      title: copy.columns.product,
      sortValue: (r) => r.productTitle,
      hideable: false,
      align: 'start',
      className: 'w-1/3 min-w-96 px-3 whitespace-normal',
      render: (r) => (
        <ProductLineCell
          line={r}
          copy={copy}
          tree={
            tree
              ? {
                  open: tree.expanded[r.variantId] === true,
                  onToggle: () => tree.onToggle(r.variantId),
                }
              : null
          }
        />
      ),
    },
    {
      id: 'sku',
      title: copy.columns.sku,
      sortValue: (r) => r.sku ?? '',
      render: (r) =>
        r.variants ? null : r.sku ? (
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
      render: (r) =>
        r.variants ? (
          total(r.available, lowAt)
        ) : (
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
      render: (r) => total(r.committed),
    },
    {
      id: 'incoming',
      align: 'center',
      title: copy.columns.incoming,
      sortValue: (r) => r.incoming,
      render: (r) => total(r.incoming),
    },
    {
      id: 'onHand',
      align: 'center',
      title: copy.columns.onHand,
      sortValue: (r) => r.onHand,
      render: (r) => total(r.onHand),
    },
  ]
}
