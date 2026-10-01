// Port of sections/featured-carousel.liquid: Puck config for the one-at-a-time featured product carousel
import type { ComponentConfig } from '@puckeditor/core'
import FeaturedCarousel from '../../components/sections/glide/featured-carousel'
import { featuredCarouselContent as copy } from '../../data/glide/featured-carousel'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed } from '../framed'
import { inlineText } from '../inline-fields'
import type { GlideLoaders } from './loaders'

export type FeaturedCarouselProps = Frame & {
  eyebrow: string
  heading: string
  imageSide: 'left' | 'right'
  autoplay: boolean
  autoplayInterval: number
  showStamp: boolean
  stampText: string
  showShare: boolean
  showHelp: boolean
  helpLink: string
  slides: { handle: string; eyebrow: string }[]
  /** Filled by resolveData, one entry per slide (null when its product was not found). */
  resolved?: (CardProduct | null)[]
}

const yesNo = [
  { label: copy.fields.yes, value: true },
  { label: copy.fields.no, value: false },
]

const defaults: Omit<FeaturedCarouselProps, keyof Frame> = {
  eyebrow: copy.eyebrow,
  heading: copy.heading,
  imageSide: 'left',
  autoplay: true,
  autoplayInterval: 6,
  showStamp: false,
  stampText: copy.stampText,
  showShare: true,
  showHelp: true,
  helpLink: '',
  slides: copy.slides.map((s) => ({ ...s })),
}

export function featuredCarouselSection(loaders: GlideLoaders): ComponentConfig {
  return framed<FeaturedCarouselProps>(
    copy.label,
    {
      eyebrow: inlineText(copy.fields.eyebrow),
      heading: inlineText(copy.fields.heading),
      slides: {
        type: 'array',
        label: copy.fields.slides,
        max: 8,
        getItemSummary: (s: { handle?: string }) => s.handle || copy.fields.slide,
        defaultItemProps: { handle: '', eyebrow: '' },
        arrayFields: {
          handle: { type: 'text', label: copy.fields.handle },
          eyebrow: inlineText(copy.fields.slideEyebrow),
        },
      },
      imageSide: {
        type: 'radio',
        label: copy.fields.imageSide,
        options: [
          { label: copy.fields.left, value: 'left' },
          { label: copy.fields.right, value: 'right' },
        ],
      },
      autoplay: { type: 'radio', label: copy.fields.autoplay, options: yesNo },
      autoplayInterval: {
        type: 'number',
        label: copy.fields.autoplayInterval,
        min: 4,
        max: 12,
        step: 1,
      },
      showStamp: { type: 'radio', label: copy.fields.showStamp, options: yesNo },
      stampText: { type: 'text', label: copy.fields.stampText },
      showShare: { type: 'radio', label: copy.fields.showShare, options: yesNo },
      showHelp: { type: 'radio', label: copy.fields.showHelp, options: yesNo },
      helpLink: { type: 'text', label: copy.fields.helpLink },
    },
    defaults,
    (p) => (
      <FeaturedCarousel
        eyebrow={p.eyebrow}
        heading={p.heading}
        imageSide={p.imageSide}
        autoplay={p.autoplay}
        intervalSeconds={p.autoplayInterval}
        showStamp={p.showStamp}
        stampText={p.stampText}
        showShare={p.showShare}
        showHelp={p.showHelp}
        helpHref={p.helpLink}
        slides={(p.slides ?? []).flatMap((slide, i) => {
          const product = p.resolved?.[i]
          return product ? [{ product, eyebrow: slide.eyebrow }] : []
        })}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
        ...defaults,
      },
      resolveData: async ({ props }) => ({
        props: {
          resolved: await Promise.all(
            (props.slides ?? []).map((slide) =>
              slide.handle && loaders.loadProduct
                ? loaders.loadProduct(slide.handle)
                : Promise.resolve(null),
            ),
          ),
        },
        readOnly: { resolved: true },
      }),
    },
  )
}
