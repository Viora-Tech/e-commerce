import ProductSpecStrip from '../../components/sections/glide/product-spec-strip'
import { productSpecStripContent as copy } from '../../data/glide/product-spec-strip'
import { headline } from '../../product-data'
import { defaultSectionSettings } from '../../section-settings'
import type { Frame } from '../framed'
import { inlineText } from '../inline-fields'
import { productFramed } from './product-frame'

export type ProductSpecStripProps = Frame & {
  heading: string
  /** `value` is plain text so it can be connected to a product metafield. */
  items: { label: string; value: string; unit: string }[]
}

const defaults = { heading: copy.heading, items: copy.items.map((i) => ({ ...i })) }

export function productSpecStripSection() {
  return productFramed<ProductSpecStripProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.heading),
      items: {
        type: 'array',
        label: copy.fields.items,
        max: copy.maxItems,
        getItemSummary: (i: { label?: unknown }) =>
          (typeof i.label === 'string' && i.label) || copy.newItem.label,
        defaultItemProps: { ...copy.newItem },
        arrayFields: {
          label: inlineText(copy.fields.label),
          value: { type: 'text', label: copy.fields.value },
          unit: inlineText(copy.fields.unit),
        },
      },
    },
    defaults,
    copy,
    (p) => {
      // Headline number only: the bracketed caveat belongs in the spec groups below.
      const items = (p.items ?? [])
        .map((i) => ({ ...i, value: headline(typeof i.value === 'string' ? i.value : '') }))
        .filter((i) => i.value)
      if (items.length === 0) return null
      return <ProductSpecStrip heading={p.heading} items={items} />
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-5', padTop: 40, padBottom: 40 }),
      },
    },
  )
}
