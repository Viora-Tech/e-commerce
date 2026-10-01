import ProductSizeGuide from '../../components/sections/glide/product-size-guide'
import { productSizeGuideContent as copy } from '../../data/glide/product-size-guide'
import { sizeGuideRows } from '../../product-data'
import { defaultSectionSettings } from '../../section-settings'
import type { Frame } from '../framed'
import { inlineText, inlineTextarea } from '../inline-fields'
import { productFramed } from './product-frame'

export type ProductSizeGuideProps = Frame & {
  heading: string
  /** Plain text so it can be connected to a multi-line product metafield (`custom.size_guide`). */
  rows: string
  /** Column names: drawn on every card, so plain text rather than inline. */
  measureLabel: string
  measureUnit: string
  dimsLabel: string
  tagsLabel: string
  weightLabel: string
  note: string
}

const defaults = {
  heading: copy.heading,
  rows: copy.rows,
  measureLabel: copy.measureLabel,
  measureUnit: copy.measureUnit,
  dimsLabel: copy.dimsLabel,
  tagsLabel: copy.tagsLabel,
  weightLabel: copy.weightLabel,
  note: copy.note,
}

const str = (value: unknown, fallback: string) =>
  typeof value === 'string' && value ? value : fallback

export function productSizeGuideSection() {
  return productFramed<ProductSizeGuideProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.heading),
      rows: { type: 'textarea', label: copy.fields.rows },
      measureLabel: { type: 'text', label: copy.fields.measureLabel },
      measureUnit: { type: 'text', label: copy.fields.measureUnit },
      dimsLabel: { type: 'text', label: copy.fields.dimsLabel },
      tagsLabel: { type: 'text', label: copy.fields.tagsLabel },
      weightLabel: { type: 'text', label: copy.fields.weightLabel },
      note: inlineTextarea(copy.fields.note),
    },
    defaults,
    copy,
    (p, _product, id) => {
      const sizes = sizeGuideRows(p.rows).filter((s) => s.name)
      if (sizes.length === 0) return null
      return (
        <div className="section-size-guide">
          <ProductSizeGuide
            id={id}
            heading={p.heading}
            note={p.note}
            sizes={sizes}
            labels={{
              measure: str(p.measureLabel, copy.measureLabel),
              unit: str(p.measureUnit, copy.measureUnit),
              dims: str(p.dimsLabel, copy.dimsLabel),
              tags: str(p.tagsLabel, copy.tagsLabel),
              weight: str(p.weightLabel, copy.weightLabel),
            }}
          />
        </div>
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
