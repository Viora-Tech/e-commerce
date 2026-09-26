import type { ComponentConfig } from '@puckeditor/core'
import HeroCarousel, { type HeroSlide } from '../components/hero-carousel'

export type HeroProps = {
  slides: HeroSlide[]
  autoplaySeconds: number
  heightVh: number
}

/** The "Hero carousel" block: one or more full-bleed slides with optional CTAs. */
export function heroBlock(): ComponentConfig<HeroProps> {
  return {
    label: 'Hero carousel',
    fields: {
      slides: {
        type: 'array',
        label: 'Slides',
        getItemSummary: (s) => s.heading || 'Slide',
        arrayFields: {
          heading: { type: 'text', label: 'Heading' },
          subheading: { type: 'textarea', label: 'Subheading' },
          image: {
            type: 'object',
            label: 'Image',
            objectFields: {
              url: { type: 'text', label: 'URL' },
              alt: { type: 'text', label: 'Alt text' },
            },
          },
          cta: {
            type: 'object',
            label: 'Primary button',
            objectFields: {
              label: { type: 'text', label: 'Label' },
              href: { type: 'text', label: 'Link' },
            },
          },
          cta2: {
            type: 'object',
            label: 'Secondary button',
            objectFields: {
              label: { type: 'text', label: 'Label' },
              href: { type: 'text', label: 'Link' },
            },
          },
          textPosition: {
            type: 'radio',
            label: 'Text position',
            options: [
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
              { label: 'Right', value: 'right' },
            ],
          },
        },
      },
      autoplaySeconds: {
        type: 'number',
        label: 'Autoplay (seconds, 0 = off)',
        min: 0,
        max: 30,
      },
      heightVh: { type: 'number', label: 'Height (vh)', min: 40, max: 100 },
    },
    defaultProps: {
      slides: [
        {
          heading: 'Glide faster',
          subheading: "India's glasspad specialist.",
          image: { url: '', alt: '' },
          cta: { label: 'Shop now', href: '/collections/all' },
          textPosition: 'left',
        },
      ],
      autoplaySeconds: 5,
      heightVh: 72,
    },
    render: ({ slides, autoplaySeconds, heightVh }) => (
      <HeroCarousel
        slides={slides.map(({ cta, cta2, ...s }) => ({
          ...s,
          ...(cta?.label ? { cta } : {}),
          ...(cta2?.label ? { cta2 } : {}),
        }))}
        autoplaySeconds={autoplaySeconds}
        heightVh={heightVh}
      />
    ),
  }
}
