// Port of snippets/spec-group.liquid: one collapsible group of spec rows, laid out as tiles, columns, a list or benefits.
import type { ReactNode } from 'react'
import type { SpecRow } from '../../../product-data'

type SpecGroupProps = {
  title: ReactNode
  layout: string
  rows: SpecRow[]
  note: ReactNode
  open: boolean
}

const LAYOUTS = new Set(['tiles', 'columns', 'list', 'benefit'])

export default function SpecGroup({ title, layout, rows, note, open }: SpecGroupProps) {
  // Render logic
  const body = LAYOUTS.has(layout) ? layout : 'columns'

  return (
    <details className="product-specs__group" open={open}>
      <summary className="product-specs__summary">
        <span className="product-specs__title">{title}</span>
      </summary>
      <div className={`product-specs__body product-specs__body--${body}`}>
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are lines of one text field; two lines may read the same.
          <div className="product-specs__row" key={i}>
            {row.label ? <span className="product-specs__label">{row.label}</span> : null}
            <span className="product-specs__value">{row.value}</span>
            {row.sub ? <span className="product-specs__sub">{row.sub}</span> : null}
          </div>
        ))}
      </div>
      {note ? <p className="product-specs__note">{note}</p> : null}
    </details>
  )
}
