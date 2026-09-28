import { ExternalLink } from '@commerce/ui/icons'
import ProductThumb from '@/components/products/product-thumb'
import RowIconCells from '@/components/table/row-icon-cells'
import { orderDetailContent } from '@/data/orders'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderLine } from './order-detail-types'

type LineRow = {
  line: OrderLine
  /** How many of the line this table is about (only the unfulfilled part on "Order lines"). */
  quantity: number
}

type OrderLinesTableProps = {
  rows: LineRow[]
}

const HEAD =
  'h-10 px-3 text-left text-caption font-normal text-foreground first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6'
/* SKU and variant get their own columns only when the section is wide enough (a container
   query, so a collapsed rail counts); narrower, they stack under the title so quantity,
   price and total stay in view instead of scrolling off the edge. */
const WIDE_ONLY = 'hidden @min-[64rem]:table-cell'
const CELL =
  'h-11 border-border border-t px-3 text-body whitespace-nowrap first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6'

function variantOf(line: OrderLine): string {
  return line.variantTitle && line.variantTitle !== 'Default' ? line.variantTitle : ''
}

/** Variant and SKU under the title, for widths where their own columns are hidden. */
function subLine(line: OrderLine): string {
  return [variantOf(line), line.sku ?? ''].filter(Boolean).join(' · ')
}

/**
 * The lines grid of an order section, after the Saleor Dashboard order lines (BSD-3): a
 * small ink header, 44px rows on thin dividers, the picture in a bordered square, text
 * columns left and figures right, edge to edge inside its section.
 */
export default function OrderLinesTable({ rows }: OrderLinesTableProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()

  return (
    <div className="@container no-scrollbar -mx-4 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[30rem] border-collapse">
        <thead>
          <tr>
            <th className={HEAD}>{copy.items.columns.product}</th>
            <th className={`${HEAD} ${WIDE_ONLY}`}>{copy.items.columns.sku}</th>
            <th className={`${HEAD} ${WIDE_ONLY}`}>{copy.items.columns.variant}</th>
            <th className={`${HEAD} text-right`}>{copy.items.columns.quantity}</th>
            <th className={`${HEAD} text-right`}>{copy.items.columns.price}</th>
            <th className={`${HEAD} text-right`}>{copy.items.columns.total}</th>
            <th className="w-22 p-0">
              <span className="sr-only">{copy.items.columns.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, quantity }) => (
            <tr key={line.id}>
              <td className={`${CELL} w-full max-w-0 @min-[64rem]:w-auto @min-[64rem]:max-w-none`}>
                <span className="flex min-w-0 items-center gap-3">
                  <ProductThumb url={line.imageUrl} />
                  <span className="flex min-w-0 flex-col">
                    <span
                      className="block truncate text-ink-strong @min-[64rem]:max-w-72"
                      title={line.title ?? undefined}
                    >
                      {line.title}
                    </span>
                    {subLine(line) ? (
                      <span
                        className="block truncate text-caption text-muted-foreground @min-[64rem]:hidden"
                        title={subLine(line)}
                      >
                        {subLine(line)}
                      </span>
                    ) : null}
                  </span>
                </span>
              </td>
              <td className={`${CELL} ${WIDE_ONLY} text-muted-foreground tabular-nums`}>
                <span className="block max-w-56 truncate" title={line.sku ?? undefined}>
                  {line.sku ?? ''}
                </span>
              </td>
              <td className={`${CELL} ${WIDE_ONLY} text-muted-foreground`}>{variantOf(line)}</td>
              <td className={`${CELL} text-right tabular-nums`}>{quantity}</td>
              <td className={`${CELL} text-right text-muted-foreground tabular-nums`}>
                {fmt.money(line.unitPricePaise)}
              </td>
              <td className={`${CELL} text-right tabular-nums`}>
                {fmt.money(line.unitPricePaise * quantity)}
              </td>
              <td className="w-22 border-border border-t p-0">
                {line.productId ? (
                  <RowIconCells
                    links={[
                      {
                        label: copy.items.openProduct,
                        icon: ExternalLink,
                        href: `/products/${line.productId}`,
                        newTab: true,
                      },
                    ]}
                    menu={[
                      { label: copy.items.viewProduct, href: `/products/${line.productId}` },
                      ...(line.sku
                        ? [
                            {
                              label: copy.items.stockForSku,
                              href: `/products/inventory?query=${encodeURIComponent(line.sku)}`,
                            },
                          ]
                        : []),
                    ]}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
