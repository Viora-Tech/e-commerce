// Port of sections/product-specs.liquid: the product's spec groups, the first one open.
import type { ReactNode } from 'react'
import type { SpecRow } from '../../../product-data'
import SpecGroup from './spec-group'

type ProductSpecsProps = {
  heading: ReactNode
  openFirst: boolean
  groups: { title: ReactNode; layout: string; rows: SpecRow[]; note: ReactNode }[]
}

export default function ProductSpecs({ heading, openFirst, groups }: ProductSpecsProps) {
  return (
    <div className="section-product-specs">
      {heading ? <h2 className="product-specs__heading h2">{heading}</h2> : null}
      {groups.map((group, i) => (
        <SpecGroup
          // biome-ignore lint/suspicious/noArrayIndexKey: groups have no id and are reordered only in the editor.
          key={i}
          title={group.title}
          layout={group.layout}
          rows={group.rows}
          note={group.note}
          open={openFirst && i === 0}
        />
      ))}
    </div>
  )
}
