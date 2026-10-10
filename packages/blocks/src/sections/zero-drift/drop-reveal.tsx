import type { ComponentConfig } from '@puckeditor/core'
import DropReveal from '../../components/sections/zero-drift/drop-reveal'
import { dropRevealContent as copy, DROP_REVEAL } from '../../data/zero-drift/drop-reveal'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

export type DropRevealProps = Frame & {
  collectionHandle: string
  productCount: number
  heading: string
  subheading: string
  ctaLabel: string
  ctaLink: string
  showRibbon: boolean
  ribbonLabel: string
  markImage: Image
  /** Filled by resolveData; not edited directly. */
  resolved?: CardProduct[]
}

const defaults: Omit<DropRevealProps, keyof Frame> = {
  collectionHandle: copy.collectionHandle,
  productCount: copy.productCount,
  heading: copy.heading,
  subheading: copy.subheading,
  ctaLabel: copy.ctaLabel,
  ctaLink: '',
  showRibbon: true,
  ribbonLabel: copy.ribbonLabel,
  markImage: noImage,
}

// Port of sections/drop-reveal.liquid. Products come from the collection handle via loadProducts.
export function dropRevealSection(loaders: ZeroDriftLoaders): ComponentConfig {
  return framed<DropRevealProps>(
    copy.label,
    {
      collectionHandle: { type: 'text', label: copy.fields.collectionHandle },
      productCount: {
        type: 'number',
        label: copy.fields.productCount,
        min: DROP_REVEAL.minProducts,
        max: DROP_REVEAL.maxProducts,
      },
      heading: inlineText(copy.fields.heading),
      subheading: inlineText(copy.fields.subheading),
      ctaLabel: inlineText(copy.fields.ctaLabel),
      ctaLink: { type: 'text', label: copy.fields.ctaLink },
      showRibbon: { type: 'radio', label: copy.fields.showRibbon, options: copy.yesNo },
      ribbonLabel: inlineText(copy.fields.ribbonLabel),
      markImage: imageField(copy.fields.markImage),
    },
    defaults,
    (p) => (
      <DropReveal
        heading={p.heading}
        subheading={p.subheading}
        ctaLabel={p.ctaLabel}
        ctaLink={p.ctaLink}
        collectionHandle={p.collectionHandle}
        productCount={p.productCount}
        showRibbon={p.showRibbon}
        ribbonLabel={p.ribbonLabel}
        markImage={p.markImage}
        products={p.resolved ?? []}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ padTop: 0, padBottom: 0 }),
        ...defaults,
      },
      resolveData: async ({ props }) => ({
        props: {
          resolved: props.collectionHandle
            ? await loaders.loadProducts({
                collectionHandle: props.collectionHandle,
                limit: DROP_REVEAL.maxProducts,
              })
            : [],
        },
        readOnly: { resolved: true },
      }),
    },
  )
}
