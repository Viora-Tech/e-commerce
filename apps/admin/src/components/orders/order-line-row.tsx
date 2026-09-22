import ProductThumb from '@/components/products/product-thumb'
import { orderDetailContent as copy } from '@/data/orders'
import { formatPaise } from '@/lib/money'
import type { OrderLine } from './order-detail-types'

type OrderLineRowProps = {
  line: OrderLine
  /** Shown on the unfulfilled card, where only part of the line is going out. */
  quantity?: number
}

/** One bought item: picture, what it was, and what it cost at the time. */
export default function OrderLineRow({ line, quantity }: OrderLineRowProps) {
  // Render logic
  const qty = quantity ?? line.quantity
  const meta = [
    line.variantTitle && line.variantTitle !== 'Default' ? line.variantTitle : null,
    line.sku ? `${copy.items.sku} ${line.sku}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li className="flex items-center gap-4 py-3 first:pt-0">
      <ProductThumb url={line.imageUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{line.title}</p>
        {meta ? <p className="text-kit-body">{meta}</p> : null}
        <p className="text-kit-body tabular-nums">
          {formatPaise(line.unitPricePaise)} × {qty}
        </p>
      </div>
      <p className="shrink-0 font-medium tabular-nums">{formatPaise(line.unitPricePaise * qty)}</p>
    </li>
  )
}
