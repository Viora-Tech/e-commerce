import { formatNumber } from '@commerce/money'
import KitThumb from '@/components/kit/kit-thumb'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import AvailableCell from './available-cell'

export type InventoryRow = Awaited<ReturnType<typeof api.inventory.list>>['rows'][number]

type ColumnOptions = {
  copy: typeof inventoryContent
  canEdit: boolean
  onCommit: (row: InventoryRow, delta: number) => Promise<boolean>
  onHistory: (row: InventoryRow) => void
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
  onCommit,
  onHistory,
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
        <button
          type="button"
          onClick={() => onHistory(r)}
          className="flex items-center gap-3 text-left hover:underline"
          title={copy.cell.history}
        >
          <KitThumb src={r.imageUrl} alt="" />
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-1 text-body-strong">{r.productTitle}</span>
            {r.variantTitle && r.variantTitle !== 'Default' ? (
              <span className="line-clamp-1 text-caption text-muted-foreground">
                {r.variantTitle}
              </span>
            ) : null}
          </span>
        </button>
      ),
    },
    {
      id: 'sku',
      title: copy.columns.sku,
      sortValue: (r) => r.sku ?? '',
      render: (r) =>
        r.sku ? (
          <span className="font-mono text-caption">{r.sku}</span>
        ) : (
          <span className="text-muted-foreground">{copy.noSku}</span>
        ),
    },
    {
      id: 'available',
      align: 'end',
      title: copy.columns.available,
      sortValue: (r) => r.available,
      hideable: false,
      className: 'w-44',
      render: (r) => (
        <AvailableCell
          name={rowName(r)}
          available={r.available}
          disabled={!canEdit}
          onCommit={(delta) => onCommit(r, delta)}
        />
      ),
    },
    {
      id: 'committed',
      align: 'end',
      title: copy.columns.committed,
      sortValue: (r) => r.committed,
      render: (r) => <span className="tabular-nums">{formatNumber(r.committed)}</span>,
    },
    {
      id: 'incoming',
      align: 'end',
      title: copy.columns.incoming,
      sortValue: (r) => r.incoming,
      render: (r) => (
        <span className={r.incoming > 0 ? 'text-link tabular-nums' : 'tabular-nums'}>
          {formatNumber(r.incoming)}
        </span>
      ),
    },
    {
      id: 'onHand',
      align: 'end',
      title: copy.columns.onHand,
      sortValue: (r) => r.onHand,
      render: (r) => <span className="tabular-nums">{formatNumber(r.onHand)}</span>,
    },
  ]
}
