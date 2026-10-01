// Port of sections/latest-drop.liquid: Puck config for the single-product spotlight
import type { ComponentConfig } from '@puckeditor/core'
import LatestDrop from '../../components/sections/glide/latest-drop'
import { latestDropContent as copy } from '../../data/glide/latest-drop'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import type { GlideLoaders } from './loaders'

export type LatestDropProps = Frame & {
  productHandle: string
  kicker: string
  blurb: string
  deadline: string
  ctaLabel: string
  secondaryHref: string
  secondaryLabel: string
  specs: { label: string; value: string }[]
  /** Filled by resolveData; not edited directly. */
  resolved?: CardProduct | null
}

const defaults: Omit<LatestDropProps, keyof Frame> = {
  productHandle: '',
  kicker: copy.kicker,
  blurb: '',
  deadline: '',
  ctaLabel: copy.ctaLabel,
  secondaryHref: '',
  secondaryLabel: '',
  specs: copy.specs.map((s) => ({ ...s })),
}

export function latestDropSection(loaders: GlideLoaders): ComponentConfig {
  return framed<LatestDropProps>(
    copy.label,
    {
      productHandle: { type: 'text', label: copy.fields.productHandle },
      kicker: inlineText(copy.fields.kicker),
      blurb: inlineRichtext(copy.fields.blurb),
      specs: {
        type: 'array',
        label: copy.fields.specs,
        max: 4,
        getItemSummary: (s: { label?: string }) => s.label || copy.fields.spec,
        defaultItemProps: { label: '', value: '' },
        arrayFields: {
          label: inlineText(copy.fields.specLabel),
          value: inlineText(copy.fields.specValue),
        },
      },
      deadline: { type: 'text', label: copy.fields.deadline },
      ctaLabel: inlineText(copy.fields.ctaLabel),
      secondaryHref: { type: 'text', label: copy.fields.secondaryLink },
      secondaryLabel: inlineText(copy.fields.secondaryLabel),
    },
    defaults,
    (p) => (
      <LatestDrop
        product={p.resolved ?? null}
        kicker={p.kicker}
        blurb={p.blurb}
        ctaLabel={p.ctaLabel}
        secondaryLabel={p.secondaryLabel}
        secondaryHref={p.secondaryHref}
        deadline={p.deadline}
        specs={p.specs ?? []}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
        ...defaults,
      },
      resolveData: async ({ props }) => ({
        props: {
          resolved:
            props.productHandle && loaders.loadProduct
              ? await loaders.loadProduct(props.productHandle)
              : null,
        },
        readOnly: { resolved: true },
      }),
    },
  )
}
