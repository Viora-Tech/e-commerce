import { specCells } from '../product-specs'
import type { ProductFieldText } from '../types'
import Icon, { isIconName } from './icon'

type ProductSpecGridProps = {
  fields: Record<string, ProductFieldText> | undefined
  /** The section's `Label | field key | icon` lines. */
  spec: string
}

// The `spec_group` block of sections/main-product.liquid (snippets/spec-cells): one panel of
// icon + label + value cells from the product's own fields. A product with none of the
// listed fields draws nothing.
export default function ProductSpecGrid({ fields, spec }: ProductSpecGridProps) {
  // Early returns
  const cells = specCells(fields, spec)
  if (cells.length === 0) return null

  return (
    <div className="spec-grid">
      {cells.map((c) => (
        <SpecCell key={`${c.label}|${c.value}`} cell={c} />
      ))}
    </div>
  )
}

function SpecCell({ cell }: { cell: ReturnType<typeof specCells>[number] }) {
  return (
    <>
      {cell.group ? <p className="spec-grid__group">{cell.group}</p> : null}
      <div className="spec-grid__item">
        {isIconName(cell.icon) ? (
          <span className="spec-grid__icon">
            <Icon name={cell.icon} size={20} />
          </span>
        ) : null}
        <span className="spec-grid__text">
          <span className="spec-grid__label">{cell.label}</span>
          <span className="spec-grid__value">{cell.value}</span>
        </span>
      </div>
    </>
  )
}
