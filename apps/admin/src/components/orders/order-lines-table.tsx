import ProductThumb from '@/components/products/product-thumb'
import { orderDetailContent } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { OrderLine } from './order-detail-types'
import RowMenu from './row-menu'

type LineRow = {
  line: OrderLine
  /** How many of the line this list is about (only the unfulfilled part on "Order lines"). */
  quantity: number
}

type OrderLinesTableProps = {
  rows: LineRow[]
}

function variantOf(line: OrderLine): string {
  return line.variantTitle && line.variantTitle !== 'Default' ? line.variantTitle : ''
}

/**
 * The lines of an order section (Figma "Orders / Order detail" › Unfulfilled): one row per line,
 * no column header. A 36px thumb, the title over "variant · SKU", then "price × qty" muted and
 * the line total on the right; rows split by the border colour, edge to edge in the card.
 */
export default function OrderLinesTable({ rows }: OrderLinesTableProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()

  return (
    <ul className="flex flex-col">
      {rows.map(({ line, quantity }) => {
        const sub = [variantOf(line), line.sku ? `${copy.items.columns.sku} ${line.sku}` : '']
          .filter(Boolean)
          .join(' · ')
        return (
          <li
            key={line.id}
            className="flex items-center gap-3 border-border border-t px-4 py-3 first:border-t-0"
          >
            <ProductThumb
              url={line.imageUrl}
              className="size-9 rounded-lg border border-border bg-muted"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-ink-strong" title={line.title ?? undefined}>
                {line.title}
              </span>
              {sub ? (
                <span className="truncate text-xs text-muted-foreground" title={sub}>
                  {sub}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {fmt.money(line.unitPricePaise)} × {quantity}
            </span>
            <span className="w-20 shrink-0 text-right text-body font-medium text-ink-strong tabular-nums">
              {fmt.money(line.unitPricePaise * quantity)}
            </span>
            {line.productId ? (
              <RowMenu
                items={[
                  {
                    label: copy.items.viewProduct,
                    href: routes.products.detail(line.productId),
                  },
                  ...(line.sku
                    ? [
                        {
                          label: copy.items.stockForSku,
                          href: `${routes.stock.inventory()}?query=${encodeURIComponent(line.sku)}`,
                        },
                      ]
                    : []),
                ]}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
