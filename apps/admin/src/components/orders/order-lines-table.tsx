import ProductThumb from '@/components/products/product-thumb'
import { orderDetailContent as copy } from '@/data/orders'
import { formatPaise } from '@/lib/money'
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
const CELL =
  'h-11 border-border border-t px-3 text-body whitespace-nowrap first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6'

function variantOf(line: OrderLine): string {
  return line.variantTitle && line.variantTitle !== 'Default' ? line.variantTitle : ''
}

/**
 * The lines grid of an order section, after the Saleor Dashboard order lines (BSD-3): a
 * small ink header, 44px rows on thin dividers, the picture in a bordered square, text
 * columns left and figures right, edge to edge inside its section.
 */
export default function OrderLinesTable({ rows }: OrderLinesTableProps) {
  return (
    <div className="-mx-4 overflow-x-auto md:-mx-6">
      <table className="w-full min-w-[40rem] border-collapse">
        <thead>
          <tr>
            <th className={HEAD}>{copy.items.columns.product}</th>
            <th className={HEAD}>{copy.items.columns.sku}</th>
            <th className={HEAD}>{copy.items.columns.variant}</th>
            <th className={`${HEAD} text-right`}>{copy.items.columns.quantity}</th>
            <th className={`${HEAD} text-right`}>{copy.items.columns.price}</th>
            <th className={`${HEAD} text-right`}>{copy.items.columns.total}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, quantity }) => (
            <tr key={line.id}>
              <td className={CELL}>
                <span className="flex min-w-0 items-center gap-3">
                  <ProductThumb url={line.imageUrl} />
                  <span className="truncate text-ink-strong">{line.title}</span>
                </span>
              </td>
              <td className={`${CELL} text-muted-foreground tabular-nums`}>{line.sku ?? ''}</td>
              <td className={`${CELL} text-muted-foreground`}>{variantOf(line)}</td>
              <td className={`${CELL} text-right tabular-nums`}>{quantity}</td>
              <td className={`${CELL} text-right text-muted-foreground tabular-nums`}>
                {formatPaise(line.unitPricePaise)}
              </td>
              <td className={`${CELL} text-right tabular-nums`}>
                {formatPaise(line.unitPricePaise * quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
