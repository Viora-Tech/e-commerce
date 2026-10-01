// Port of sections/brand-lab.liquid: Puck config for the dark brand story band
import type { ComponentConfig } from '@puckeditor/core'
import BrandLab from '../../components/sections/glide/brand-lab'
import { brandLabContent as copy } from '../../data/glide/brand-lab'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import type { GlideLoaders } from './loaders'

export type BrandLabProps = Frame & {
  heading: string
  intro: string
  ctaLabel: string
  ctaHref: string
  brands: { name: string; description: string; logo: Image; href: string }[]
}

const defaults: Omit<BrandLabProps, keyof Frame> = {
  heading: copy.heading,
  intro: copy.intro,
  ctaLabel: copy.ctaLabel,
  ctaHref: copy.ctaHref,
  brands: copy.brands.map((b) => ({
    name: b.name,
    description: b.description,
    logo: noImage,
    href: b.href,
  })),
}

// Static content only: the section needs no loaders.
export function brandLabSection(_loaders?: GlideLoaders): ComponentConfig {
  return framed<BrandLabProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.heading),
      intro: inlineRichtext(copy.fields.intro),
      ctaLabel: inlineText(copy.fields.ctaLabel),
      ctaHref: { type: 'text', label: copy.fields.ctaHref },
      brands: {
        type: 'array',
        label: copy.fields.brands,
        max: 8,
        getItemSummary: (b: { name?: string }) => b.name || copy.fields.brand,
        defaultItemProps: { name: copy.newBrand, description: '', logo: noImage, href: '' },
        arrayFields: {
          name: inlineText(copy.fields.name),
          description: inlineText(copy.fields.description),
          logo: imageField(copy.fields.logo),
          href: { type: 'text', label: copy.fields.href },
        },
      },
    },
    defaults,
    (p) => (
      <BrandLab
        heading={p.heading}
        intro={p.intro}
        ctaLabel={p.ctaLabel}
        ctaHref={p.ctaHref}
        brands={p.brands ?? []}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
        ...defaults,
      },
    },
  )
}
