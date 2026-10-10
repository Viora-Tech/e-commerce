// Port of sections/product-spec-strip.liquid: up to six headline numbers in a row, label under each.
import type { ReactNode } from 'react'

type ProductSpecStripProps = {
  heading: ReactNode
  items: { label: ReactNode; value: string; unit: ReactNode }[]
}

export default function ProductSpecStrip({ heading, items }: ProductSpecStripProps) {
  return (
    <div className="section-spec-strip">
      {heading ? <h2 className="spec-strip__heading text-caption">{heading}</h2> : null}
      <dl className="spec-strip__list">
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: specs have no id and are reordered only in the editor.
          <div className="spec-strip__item" key={i}>
            <dt className="spec-strip__label">{item.label}</dt>
            <dd className="spec-strip__value">
              {item.value}
              {item.unit ? <span className="spec-strip__unit">{item.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
