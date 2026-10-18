import ProductFeatures from '../../components/sections/zero-drift/product-features'
import { productFeaturesContent as copy } from '../../data/zero-drift/product-features'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, type Image, imageField } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import { productFramed } from './product-frame'

export type ProductFeaturesProps = Frame & {
  heading: string
  style: 'cards' | 'rows'
  features: { image: Image; heading: string; text: string; layout: string }[]
}

const defaults = {
  heading: '',
  style: 'cards' as const,
  features: copy.features.map((f) => ({ ...f })),
}

export function productFeaturesSection() {
  return productFramed<ProductFeaturesProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.sectionHeading),
      style: { type: 'radio', label: copy.fields.style, options: copy.styles },
      features: {
        type: 'array',
        label: copy.fields.features,
        getItemSummary: (f: { heading?: unknown }) =>
          (typeof f.heading === 'string' && f.heading) || copy.newFeature.heading,
        defaultItemProps: { ...copy.newFeature, image: { ...copy.newFeature.image } },
        arrayFields: {
          image: imageField(copy.fields.image),
          heading: inlineText(copy.fields.heading),
          text: inlineRichtext(copy.fields.text),
          layout: { type: 'select', label: copy.fields.layout, options: copy.layouts },
        },
      },
    },
    defaults,
    copy,
    (p) => {
      const features = (p.features ?? []).map((f) => ({
        ...f,
        image: f.image ?? { url: '', alt: '' },
      }))
      if (features.length === 0) return null
      // Sections saved before the card look keep their image rows.
      return <ProductFeatures heading={p.heading} style={p.style ?? 'rows'} features={features} />
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
      },
    },
  )
}
