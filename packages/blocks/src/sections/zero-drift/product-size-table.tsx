import ProductSizeTable from '../../components/sections/zero-drift/product-size-table'
import { productSizeTableContent as copy } from '../../data/zero-drift/product-size-table'
import { sizeTableRows } from '../../product-data'
import { defaultSectionSettings } from '../../section-settings'
import type { Frame } from '../framed'
import { inlineText, inlineTextarea } from '../inline-fields'
import { productFramed } from './product-frame'

export type ProductSizeTableProps = Frame & {
  heading: string
  /** Plain text so it can be connected to a multi-line product metafield (`custom.size_table`). */
  table: string
  showUnits: boolean
  note: string
}

const defaults = { heading: copy.heading, table: copy.table, showUnits: true, note: copy.note }

export function productSizeTableSection() {
  return productFramed<ProductSizeTableProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.heading),
      table: { type: 'textarea', label: copy.fields.table },
      showUnits: { type: 'radio', label: copy.fields.showUnits, options: copy.yesNo },
      note: inlineTextarea(copy.fields.note),
    },
    defaults,
    copy,
    (p) => {
      const parsed = sizeTableRows(p.table)
      if (!parsed) return null
      return (
        <ProductSizeTable
          heading={p.heading}
          // In the editor the heading is a React node; the region then falls back to the fixed name.
          regionLabel={typeof p.heading === 'string' && p.heading ? p.heading : copy.regionLabel}
          note={p.note}
          showUnits={p.showUnits !== false}
          head={parsed.head}
          rows={parsed.rows}
        />
      )
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
      },
    },
  )
}
