import ProductSpecs from '../../components/sections/zero-drift/product-specs'
import { productSpecsContent as copy } from '../../data/zero-drift/product-specs'
import { specRows } from '../../product-data'
import { defaultSectionSettings } from '../../section-settings'
import type { Frame } from '../framed'
import { inlineText, inlineTextarea } from '../inline-fields'
import { productFramed } from './product-frame'

export type ProductSpecsProps = Frame & {
  heading: string
  openFirst: boolean
  /** `rows` is plain text so it can be connected to a multi-line product metafield. */
  groups: { title: string; layout: string; rows: string; note: string }[]
}

const defaults = {
  heading: copy.heading,
  openFirst: true,
  groups: copy.groups.map((g) => ({ ...g })),
}

export function productSpecsSection() {
  return productFramed<ProductSpecsProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.heading),
      openFirst: { type: 'radio', label: copy.fields.openFirst, options: copy.yesNo },
      groups: {
        type: 'array',
        label: copy.fields.groups,
        getItemSummary: (g: { title?: unknown }) =>
          (typeof g.title === 'string' && g.title) || copy.newGroup.title,
        defaultItemProps: { ...copy.newGroup },
        arrayFields: {
          title: inlineText(copy.fields.title),
          layout: { type: 'select', label: copy.fields.layout, options: copy.layouts },
          rows: { type: 'textarea', label: copy.fields.rows },
          note: inlineTextarea(copy.fields.note),
        },
      },
    },
    defaults,
    copy,
    (p) => {
      const groups = (p.groups ?? [])
        .map((g) => ({ ...g, rows: specRows(g.rows) }))
        .filter((g) => g.rows.length > 0)
      if (groups.length === 0) return null
      return <ProductSpecs heading={p.heading} openFirst={p.openFirst !== false} groups={groups} />
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 48, padBottom: 48 }),
      },
    },
  )
}
