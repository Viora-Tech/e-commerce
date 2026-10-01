import type { CSSProperties } from 'react'
import { mainProductContent as copy } from '../data/glide/main-product'

type ProductStockBarProps = {
  /** Units of the selected variant on hand. */
  available: number
  purchasable: boolean
  /** The bar shows at or below this many units; above it, an "In stock" chip. */
  threshold: number
  preorder: boolean
}

const ui = copy.ui

/** Splits a "{count}" template so the number can sit in its own styled span. */
function countParts(template: string) {
  const [before = '', after = ''] = template.split('{count}')
  return { before, after }
}

// Port of snippets/stock-bar.liquid: "Only 3 left" over a track filled to the share of the
// threshold that remains, critical (warning colour) at a quarter or less; above the
// threshold an "In stock" chip. Nothing for a pre-order or a sold-out variant.
export default function ProductStockBar({
  available,
  purchasable,
  threshold,
  preorder,
}: ProductStockBarProps) {
  // Early returns
  if (preorder || !purchasable || available <= 0) return null
  const limit = Math.max(1, threshold)
  if (available > limit) {
    return (
      <p className="stock-status">
        <span className="status-chip status-chip--in">
          <span className="status-chip__dot" aria-hidden="true" />
          {ui.inStock}
        </span>
      </p>
    )
  }

  // Render logic
  const pct = Math.min(100, Math.max(6, Math.floor((available * 100) / limit)))
  const { before, after } = countParts(
    available <= Math.min(ui.urgentUnits, limit) ? ui.stockLeft : ui.stockCount,
  )

  return (
    <div className={`stock-bar${pct <= 25 ? ' is-critical' : ''}`}>
      <p className="stock-bar__label text-small" role="status">
        {before}
        <span className="stock-bar__count">{available}</span>
        {after}
      </p>
      <div className="stock-bar__track" aria-hidden="true">
        <span className="stock-bar__fill" style={{ '--stock-pct': `${pct}%` } as CSSProperties} />
      </div>
    </div>
  )
}
